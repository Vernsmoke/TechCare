// Shared publishing workflow for guides, resources, and booths. Keep content
// validation, revision checks, audit entries, and media cleanup together here.
import { all, one, run, now, transaction } from './db.mjs';
import { Problem, requireUser } from './auth.mjs';
import * as v from './validation.mjs';
import { saveMedia, discardManagedMedia } from './media.mjs';
import { campusImages } from '../campus-images.mjs';

const kinds = ['guides', 'resources', 'booths'];
const limits = { guides: 100, resources: 200, booths: 50 };
function kindName(kind) {
  return v.choice(kind, kinds, 'content type');
}
export async function managedContent(kind, admin = false) {
  kindName(kind);
  return (
    await all(
      `SELECT * FROM ${kind} ${admin ? '' : "WHERE status='published'"} ORDER BY ${kind === 'guides' ? 'id' : 'id DESC'}`,
    )
  ).map((row) => {
    if (row.steps) row.steps = JSON.parse(row.steps);
    if (row.preparation) row.preparation = JSON.parse(row.preparation);
    if (!admin) {
      delete row.status;
      delete row.revision;
    }
    return row;
  });
}
async function current(kind, d) {
  const row = await one(`SELECT * FROM ${kind} WHERE id=?`, v.id(d.id));
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
async function audit(me, action, kind, id) {
  await run(
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
    let discarded;
    await transaction(async () => {
      const row = await current(kind, d);
      if (action === 'delete') {
        await run(`DELETE FROM ${kind} WHERE id=?`, row.id);
        discarded = row.url || row.image;
      } else {
        await run(
          `UPDATE ${kind} SET status=?,revision=revision+1 WHERE id=?`,
          v.choice(d.status, ['draft', 'published'], 'visibility'),
          row.id,
        );
      }
      await audit(me, action, kind, row.id);
    });
    if (discarded) await discardManagedMedia(discarded);
    return { message: action === 'delete' ? 'Content deleted.' : 'Visibility updated.' };
  }
  const fields = details(kind, d);
  const existing = d.id ? await current(kind, d) : null;
  if (!existing && (await one(`SELECT count(*) AS n FROM ${kind}`)).n >= limits[kind])
    throw new Problem(
      `Keep up to ${limits[kind]} items. Delete an old item before adding another.`,
    );
  let uploaded;
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
  let id;
  try {
    await transaction(async () => {
      const keys = Object.keys(fields),
        values = Object.values(fields);
      if (existing) {
        await current(kind, d);
        id = existing.id;
        await run(
          `UPDATE ${kind} SET ${keys.map((key) => `\`${key}\`=?`).join(',')},revision=revision+1 WHERE id=?`,
          ...values,
          id,
        );
      } else {
        if ((await one(`SELECT count(*) AS n FROM ${kind}`)).n >= limits[kind])
          throw new Problem('Content limit reached.');
        // Keep identities stable after deletion, including for an editor still open in another tab.
        id = (
          await one(
            `SELECT max(\`value\`)+1 AS id FROM (SELECT coalesce(max(id),0) AS \`value\` FROM ${kind} UNION ALL SELECT coalesce(max(target),0) FROM audit WHERE kind=?) AS id_sources`,
            kind,
          )
        ).id;
        await run(
          `INSERT INTO ${kind}(id,${keys.map((key) => `\`${key}\``).join(',')},created) VALUES(?,${keys.map(() => '?').join(',')},?)`,
          id,
          ...values,
          now(),
        );
      }
      await audit(me, 'save', kind, id);
    });
  } catch (error) {
    if (uploaded) await discardManagedMedia(uploaded);
    throw error;
  }
  const oldMedia = existing?.url || existing?.image;
  if (oldMedia && oldMedia !== (fields.url || fields.image)) await discardManagedMedia(oldMedia);
  return { id, message: fields.status === 'published' ? 'Content published.' : 'Draft saved.' };
}
