// Validates, transforms, stores, and access-checks uploaded media. Read access
// is tied to each media category and, where relevant, its published record.
import sharp from 'sharp';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dataDir, one, run, now, transaction } from './db.mjs';
import { Problem, member } from './auth.mjs';
const execute = promisify(execFile);
// CHANGE THESE LIMITS to match your storage budget and acceptable upload sizes.
const MAX_IMAGE_BYTES = 3000000;
const MAX_VIDEO_BYTES = 20000000;
const MAX_OWNER_STORAGE_BYTES = 100000000;
const MAX_TOTAL_STORAGE_BYTES = 1000000000;

export async function saveMedia(data, owner, access, video = false, logo = false) {
  if (typeof data !== 'string') throw new Problem('Choose a file to upload.');
  const match = data.match(
    /^data:(image\/(?:png|jpeg|webp)|video\/(?:mp4|webm));base64,([A-Za-z0-9+/]*={0,2})$/,
  );
  if (!match || match[2].length % 4 !== 0 || video !== match[1].startsWith('video/'))
    throw new Problem('Choose a valid PNG, JPEG, WebP image or MP4/WebM video.');
  let buffer = Buffer.from(match[2], 'base64');
  if (
    buffer.toString('base64') !== match[2] ||
    buffer.length > (video ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)
  )
    throw new Problem(
      video
        ? `Video exceeds ${MAX_VIDEO_BYTES / 1000000} MB.`
        : `Image exceeds ${MAX_IMAGE_BYTES / 1000000} MB.`,
    );
  const used = (await one('SELECT coalesce(sum(bytes),0) AS bytes FROM media WHERE owner=?', owner))
    .bytes;
  if (used + buffer.length > MAX_OWNER_STORAGE_BYTES)
    throw new Problem('Your upload allowance has been reached. Contact the project team.', 413);
  const dir = join(dataDir(), 'media');
  await mkdir(dir, { recursive: true });
  let ext = 'webp',
    mime = 'image/webp';
  if (video) {
    // CHANGE FOR YOUR DEPLOYMENT: install FFprobe and set this to its executable path.
    if (!process.env.TECHCARE_FFPROBE)
      throw new Problem(
        'Video uploads need the server media validator. You can publish a direct HTTPS video link instead.',
        503,
      );
    ext = match[1].split('/')[1];
    mime = match[1];
    const temp = join(dir, `${randomBytes(16).toString('hex')}.tmp`);
    try {
      await writeFile(temp, buffer);
      const { stdout } = await execute(
        process.env.TECHCARE_FFPROBE,
        ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', temp],
        { timeout: 15000, maxBuffer: 1000000, windowsHide: true },
      );
      const info = JSON.parse(stdout),
        streams = info.streams?.filter((s) => s.codec_type === 'video');
      if (
        !streams?.length ||
        !Number.isFinite(Number(info.format?.duration)) ||
        Number(info.format.duration) > 1800 ||
        streams.some((s) => s.width > 3840 || s.height > 2160)
      )
        throw 0;
      const formats = info.format?.format_name || '';
      if (ext === 'mp4' ? !formats.includes('mp4') : !formats.includes('webm')) throw 0;
    } catch {
      throw new Problem(
        'Video could not be validated. Use an intact MP4/WebM under 30 minutes and 4K.',
      );
    } finally {
      await unlink(temp).catch(() => {});
    }
  } else {
    try {
      const pipeline = sharp(buffer, { limitInputPixels: 16000000, failOn: 'warning' }),
        meta = await pipeline.metadata();
      if (!['png', 'jpeg', 'webp'].includes(meta.format) || meta.pages > 1) throw 0;
      pipeline.rotate();
      if (logo)
        pipeline.resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true });
      buffer = await pipeline.webp({ quality: 85 }).toBuffer();
    } catch {
      throw new Problem(
        'This image is invalid or too large in dimensions. Choose a complete PNG, JPEG, or WebP under 16 megapixels.',
      );
    }
  }
  const name = `${randomBytes(20).toString('hex')}.${ext}`;
  await writeFile(join(dir, name), buffer);
  try {
    // File and metadata must succeed together; remove the file if the DB quota
    // check or insert fails so orphaned uploads do not accumulate.
    await transaction(async () => {
      if (
        (await one('SELECT coalesce(sum(bytes),0) AS bytes FROM media WHERE owner=?', owner))
          .bytes +
          buffer.length >
          MAX_OWNER_STORAGE_BYTES ||
        (await one('SELECT coalesce(sum(bytes),0) AS bytes FROM media')).bytes + buffer.length >
          MAX_TOTAL_STORAGE_BYTES
      )
        throw new Problem(
          'The upload storage allowance has been reached. Contact the project team.',
          413,
        );
      await run(
        'INSERT INTO media VALUES(?,?,?,?,?,?)',
        name,
        owner,
        access,
        mime,
        buffer.length,
        now(),
      );
    });
  } catch (error) {
    await unlink(join(dir, name)).catch(() => {});
    throw error;
  }
  return `/api/media/${name}`;
}
export async function readMedia(name, viewer) {
  if (!/^[a-f0-9]{40}\.(webp|mp4|webm)$/.test(name)) throw new Problem('Media not found.', 404);
  const asset = await one('SELECT * FROM media WHERE name=?', name);
  if (!asset) throw new Problem('Media not found.', 404);
  if (asset.access === 'managed') {
    const url = `/api/media/${name}`;
    const published = await one(
      "SELECT 1 FROM resources WHERE url=? AND status='published' UNION ALL SELECT 1 FROM booths WHERE image=? AND status='published' LIMIT 1",
      url,
      url,
    );
    if (!published && viewer?.role !== 'admin') throw new Problem('Media not available.', 403);
  }
  if (asset.access === 'announcement') {
    const announcement = await one(
      'SELECT status FROM announcements WHERE image=?',
      `/api/media/${name}`,
    );
    if (!announcement || (announcement.status !== 'published' && viewer?.role !== 'admin'))
      throw new Problem('Media not available.', 403);
  }
  if (asset.access === 'question') {
    const post = await one('SELECT user_id,status FROM posts WHERE photo=?', `/api/media/${name}`);
    if (
      !post ||
      (post.status !== 'published' &&
        post.user_id !== viewer?.id &&
        !['admin', 'moderator'].includes(viewer?.role))
    )
      throw new Problem('Media not available.', 403);
  }
  if (asset.access === 'profile') {
    const owner = await one('SELECT * FROM users WHERE id=?', asset.owner);
    if (!owner || !(await member(owner, viewer)).avatar || owner.avatar !== `/api/media/${name}`)
      throw new Problem('Media not available.', 403);
  }
  try {
    return { buffer: await readFile(join(dataDir(), 'media', name)), mime: asset.mime };
  } catch {
    throw new Problem('Media not found.', 404);
  }
}

export async function discardQuestionMedia(url, owner) {
  const name = url.replace('/api/media/', '');
  if (!/^[a-f0-9]{40}\.webp$/.test(name)) return;
  // Only remove an unattached upload belonging to this failed submission.
  if (await one('SELECT 1 FROM posts WHERE photo=?', url)) return;
  const result = await run(
    "DELETE FROM media WHERE name=? AND owner=? AND access='question'",
    name,
    owner,
  );
  if (result.changes) await unlink(join(dataDir(), 'media', name)).catch(() => {});
}

export async function discardAnnouncementMedia(url) {
  const name = url.replace('/api/media/', '');
  if (
    !/^[a-f0-9]{40}\.webp$/.test(name) ||
    (await one('SELECT 1 FROM announcements WHERE image=?', url))
  )
    return;
  const result = await run("DELETE FROM media WHERE name=? AND access='announcement'", name);
  if (result.changes) await unlink(join(dataDir(), 'media', name)).catch(() => {});
}

export async function discardManagedMedia(url) {
  const name = url.replace('/api/media/', '');
  if (!/^[a-f0-9]{40}\.(webp|mp4|webm)$/.test(name)) return;
  if (
    await one(
      'SELECT 1 FROM resources WHERE url=? UNION ALL SELECT 1 FROM booths WHERE image=? UNION ALL SELECT 1 FROM settings WHERE `value`=? LIMIT 1',
      url,
      url,
      url,
    )
  )
    return;
  const result = await run("DELETE FROM media WHERE name=? AND access='managed'", name);
  if (result.changes) await unlink(join(dataDir(), 'media', name)).catch(() => {});
}
