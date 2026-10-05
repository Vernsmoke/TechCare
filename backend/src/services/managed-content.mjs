import { all, one, run, now, transaction } from '../config/db.mjs';
import { Problem, requireUser } from '../middleware/auth.mjs';
import * as v from '../validations/validation.mjs';
import { saveMedia, discardManagedMedia } from './media.mjs';
import { campusImages } from '../../../shared/src/campus-images.mjs';

const kinds = ['guides', 'resources', 'booths'];
const limits = { guides: 100, resources: 200, booths: 50 };
function kindName(kind) {
  return v.choice(kind, kinds, 'content type');
}
export function managedContent(kind, admin = false) {
  kindName(kind);
  return all(
    `SELECT * FROM ${kind} ${admin ? '' : "WHERE status='published'"} ORDER BY ${kind === 'guides' ? 'id' : 'id DESC'}`,
  ).map((row) => {
    if (row.steps) row.steps = JSON.parse(row.steps);
    if (row.images) row.images = JSON.parse(row.images);
    if (row.preparation) row.preparation = JSON.parse(row.preparation);
    if (!admin) {
      delete row.status;
      delete row.revision;
    }
    return row;
  });
}
function current(kind, d) {
  const row = one(`SELECT * FROM ${kind} WHERE id=?`, v.id(d.id));
  if (!row) throw new Problem('Content not found.', 404);
  if (Number(d.revision) !== row.revision)
    throw new Problem('This content changed. Refresh the list before editing it again.', 409);
  return row;
}
function lines(value, label, required = true) {
  const list = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\r?\n/).filter((line) => line.trim())
      : [];
  if (list.length < (required ? 1 : 0) || list.length > 20)
    throw new Problem(`${label} must contain ${required ? '1' : '0'} to 20 lines.`);
  return JSON.stringify(list.map((line) => v.text(line, label, 3, 800)));
}
function date(value) {
  const result = v.text(value || '', 'Date', 0, 10);
  if (
    result &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(result) ||
      !Number.isFinite(Date.parse(result)) ||
      new Date(result).toISOString().slice(0, 10) !== result)
  )
    throw new Problem('Choose a valid date.');
  return result;
}
function details(kind, d) {
  const common = {
    title: v.text(d.title, 'Title', 4, 120),
    status: v.choice(d.status, ['draft', 'published'], 'visibility'),
  };
  if (kind === 'guides')
    return {
      ...common,
      summary: v.text(d.summary, 'Summary', 4, 500),
      category: v.choice(d.category, v.categories, 'category'),
      time: v.text(d.time, 'Reading time', 2, 40),
      icon: v.choice(d.icon, ['desktop', 'wifi', 'laptop', 'shield'], 'guide icon'),
      steps: lines(d.steps, 'Guide steps'),
    };
  if (kind === 'resources')
    return {
      ...common,
      description: v.text(d.description || '', 'Description', 0, 500),
      category: v.choice(d.category, v.categories, 'category'),
      type: v.choice(d.type, ['external', 'image', 'video'], 'resource type'),
      author: v.text(d.author, 'Source credit', 2, 80),
    };
  return {
    ...common,
    description: v.text(d.description, 'Description', 4, 1000),
    label: v.text(d.label, 'Activity status label', 2, 80),
    date: date(d.date),
    dateNote: v.text(d.dateNote || '', 'Date note', 0, 160),
    venue: v.text(d.venue, 'Venue', 2, 160),
    hours: v.text(d.hours, 'Hours', 2, 160),
    alt: v.text(d.alt, 'Image description', 3, 200),
    steps: lines(d.steps, 'What to expect'),
    preparation: lines(d.preparation, 'Preparation', false),
    safety: v.text(d.safety, 'Safety guidance', 10, 2000),
    note: v.text(d.note || '', 'Additional note', 0, 1000),
  };
}
function audit(me, action, kind, id) {
  run(
    'INSERT INTO audit(actor,action,kind,target,created) VALUES(?,?,?,?,?)',
    me.id,
    action,
    kind,
    id,
    now(),
  );
}
export async function changeManagedContent(kind, d, me, staffCreate = false) {
  kindName(kind);
  requireUser(me, staffCreate && kind === 'resources' ? ['admin', 'moderator'] : ['admin']);
  if (staffCreate && (kind !== 'resources' || d.id || d.action !== 'save'))
    throw new Problem('Use the admin content tools to edit existing content.', 403);
  const action = v.choice(d.action, ['save', 'visibility', 'delete'], 'action');
  if (action !== 'save') {
    let discarded = [];
    transaction(() => {
      const row = current(kind, d);
      if (action === 'delete') {
        run(`DELETE FROM ${kind} WHERE id=?`, row.id);
        discarded = [
          row.url,
          row.image,
          row.cover,
          ...JSON.parse(row.images || '[]').map((image) => image.url),
        ].filter(Boolean);
      } else {
        run(
          `UPDATE ${kind} SET status=?,revision=revision+1 WHERE id=?`,
          v.choice(d.status, ['draft', 'published'], 'visibility'),
          row.id,
        );
      }
      audit(me, action, kind, row.id);
    });
    for (const url of discarded) await discardManagedMedia(url);
    return { message: action === 'delete' ? 'Content deleted.' : 'Visibility updated.' };
  }
  const fields = details(kind, d);
  const existing = d.id ? current(kind, d) : null;
  if (!existing && one(`SELECT count(*) AS n FROM ${kind}`).n >= limits[kind])
    throw new Problem(
      `Keep up to ${limits[kind]} items. Delete an old item before adding another.`,
    );
  let uploaded;
  const extraUploads = [];
  try {
    if (kind === 'guides') {
      const previous = JSON.parse(existing?.images || '[]');
      let images;
      try {
        images =
          d.images === undefined
            ? previous
            : typeof d.images === 'string'
              ? JSON.parse(d.images)
              : d.images;
      } catch {
        throw new Problem('Choose valid guide images.');
      }
      if (!Array.isArray(images) || images.length > 20)
        throw new Problem('Use up to 20 step images.');
      const count = JSON.parse(fields.steps).length;
      const result = [];
      for (const image of images) {
        const step = v.id(image.step);
        if (step > count || result.some((entry) => entry.step === step))
          throw new Problem('Attach one image to each existing step.');
        const alt = v.text(image.alt, 'Image description', 3, 200);
        let url = image.url;
        if (image.file) {
          url = await saveMedia(image.file, me.id, 'managed');
          extraUploads.push(url);
        } else if (!previous.some((entry) => entry.url === url))
          throw new Problem('Choose an image for this guide.');
        result.push({ step, alt, url });
      }
      fields.images = JSON.stringify(result);
    }
    if (kind === 'resources') {
      if (fields.type === 'external') fields.url = v.httpsURL(d.url);
      else if (d.file)
        fields.url = uploaded = await saveMedia(d.file, me.id, 'managed', fields.type === 'video');
      else if (fields.type === 'video' && d.url) fields.url = v.httpsURL(d.url);
      else if (existing?.type === fields.type) fields.url = existing.url;
      else throw new Problem('Upload a file, or provide a direct HTTPS video link.');
    }
    if (kind === 'booths') {
      fields.image = existing?.image || '/static/techcare-hero.webp';
      if (d.file) fields.image = uploaded = await saveMedia(d.file, me.id, 'managed');
      else if (d.campusImage) {
        const stock = campusImages.find((image) => image.key === d.campusImage);
        if (!stock) throw new Problem('Choose a valid campus image.');
        fields.image = stock.image;
      }
    }
    if (kind === 'resources') {
      fields.cover = d.removeCover === '1' ? '' : existing?.cover || '';
      if (d.coverFile) {
        fields.cover = await saveMedia(d.coverFile, me.id, 'managed');
        extraUploads.push(fields.cover);
      }
    }
  } catch (error) {
    for (const url of [uploaded, ...extraUploads].filter(Boolean)) await discardManagedMedia(url);
    throw error;
  }
  let id;
  try {
    transaction(() => {
      const keys = Object.keys(fields),
        values = Object.values(fields);
      if (existing) {
        current(kind, d);
        id = existing.id;
        run(
          `UPDATE ${kind} SET ${keys.map((key) => `${key}=?`).join(',')},revision=revision+1 WHERE id=?`,
          ...values,
          id,
        );
      } else {
        if (one(`SELECT count(*) AS n FROM ${kind}`).n >= limits[kind])
          throw new Problem('Content limit reached.');
        // Keep identities stable after deletion, including for an editor still open in another tab.
        id = one(
          `SELECT max(value)+1 AS id FROM (SELECT coalesce(max(id),0) AS value FROM ${kind} UNION ALL SELECT coalesce(max(target),0) FROM audit WHERE kind=?)`,
          kind,
        ).id;
        run(
          `INSERT INTO ${kind}(id,${keys.join(',')},created) VALUES(?,${keys.map(() => '?').join(',')},?)`,
          id,
          ...values,
          now(),
        );
      }
      audit(me, 'save', kind, id);
    });
  } catch (error) {
    if (uploaded) await discardManagedMedia(uploaded);
    for (const url of extraUploads) await discardManagedMedia(url);
    throw error;
  }
  const oldMedia = existing?.url || existing?.image;
  if (oldMedia && oldMedia !== (fields.url || fields.image)) await discardManagedMedia(oldMedia);
  for (const url of [
    existing?.cover,
    ...JSON.parse(existing?.images || '[]').map((image) => image.url),
  ].filter(Boolean))
    await discardManagedMedia(url);
  return { id, message: fields.status === 'published' ? 'Content published.' : 'Draft saved.' };
}
