import { all, one, run, now, transaction } from './db.mjs';
import { Problem, requireUser } from './auth.mjs';
import * as v from './validation.mjs';
import { saveMedia, discardAnnouncementMedia } from './media.mjs';
import { campusImages } from '../campus-images.mjs';

export function announcements(admin = false) {
  return all(
    `SELECT id,title,description,image,alt,date,link${admin ? ',status,position,revision' : ''} FROM announcements ${admin ? '' : "WHERE status='published'"} ORDER BY position,id`,
  );
}
function current(d) {
  const row = one('SELECT * FROM announcements WHERE id=?', v.id(d.id));
  if (!row) throw new Problem('Announcement not found.', 404);
  if (Number(d.revision) !== row.revision)
    throw new Problem('This announcement changed. Refresh the list before trying again.', 409);
  return row;
}
function audit(me, action, id) {
  run(
    "INSERT INTO audit(actor,action,kind,target,created) VALUES(?,?,'announcement',?,?)",
    me.id,
    action,
    id,
    now(),
  );
}
function details(d) {
  const date = v.text(d.date || '', 'Event date', 0, 10);
  if (
    date &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date)
  )
    throw new Problem('Choose a valid event date.');
  const link = v.text(d.link || '', 'Details link', 0, 1000);
  if (link) v.httpsURL(link);
  return {
    title: v.text(d.title, 'Title', 3, 100),
    description: v.text(d.description || '', 'Description', 0, 280),
    alt: v.text(d.alt, 'Image description', 3, 160),
    status: v.choice(d.status, ['draft', 'published'], 'visibility'),
    date,
    link,
  };
}
export async function changeAnnouncement(d, me) {
  requireUser(me, ['admin']);
  const action = v.choice(d.action, ['save', 'visibility', 'move', 'delete'], 'action');
  if (action !== 'save') {
    let discarded = '';
    transaction(() => {
      const row = current(d);
      if (action === 'delete') {
        run('DELETE FROM announcements WHERE id=?', row.id);
        discarded = row.image;
      } else if (action === 'visibility') {
        const status = v.choice(d.status, ['draft', 'published'], 'visibility');
        run('UPDATE announcements SET status=?,revision=revision+1 WHERE id=?', status, row.id);
      } else {
        const direction = v.choice(d.direction, ['up', 'down'], 'direction');
        const list = announcements(true),
          index = list.findIndex((item) => item.id === row.id);
        const other = list[index + (direction === 'up' ? -1 : 1)];
        if (other) {
          run(
            'UPDATE announcements SET position=?,revision=revision+1 WHERE id=?',
            other.position,
            row.id,
          );
          run(
            'UPDATE announcements SET position=?,revision=revision+1 WHERE id=?',
            row.position,
            other.id,
          );
        }
      }
      audit(me, action, row.id);
    });
    if (discarded) await discardAnnouncementMedia(discarded);
    return { message: action === 'delete' ? 'Announcement deleted.' : 'Announcements updated.' };
  }
  const fields = details(d);
  const existing = d.id ? current(d) : null;
  if (!existing && one('SELECT count(*) AS n FROM announcements').n >= 12)
    throw new Problem('Keep up to 12 announcements. Delete an old one to add another.');
  let image = existing?.image || '',
    uploaded = '';
  if (d.campusImage) {
    const stock = campusImages.find((item) => item.key === d.campusImage);
    if (!stock) throw new Problem('Choose a valid campus image.');
    image = stock.image;
  } else if (d.file) uploaded = image = await saveMedia(d.file, me.id, 'announcement');
  if (!image) throw new Problem('Choose an announcement image.');
  let id;
  try {
    transaction(() => {
      const { title, description, alt, date, link, status } = fields;
      if (existing) {
        current(d);
        id = existing.id;
        run(
          'UPDATE announcements SET title=?,description=?,image=?,alt=?,date=?,link=?,status=?,revision=revision+1 WHERE id=?',
          title,
          description,
          image,
          alt,
          date,
          link,
          status,
          id,
        );
      } else {
        if (one('SELECT count(*) AS n FROM announcements').n >= 12)
          throw new Problem('Keep up to 12 announcements.');
        const position = one('SELECT coalesce(max(position),0)+1 AS next FROM announcements').next;
        id = Number(
          run(
            'INSERT INTO announcements(title,description,image,alt,date,link,status,position,created) VALUES(?,?,?,?,?,?,?,?,?)',
            title,
            description,
            image,
            alt,
            date,
            link,
            status,
            position,
            now(),
          ).lastInsertRowid,
        );
      }
      audit(me, 'save', id);
    });
  } catch (error) {
    if (uploaded) await discardAnnouncementMedia(uploaded);
    throw error;
  }
  if (existing && image !== existing.image) await discardAnnouncementMedia(existing.image);
  return {
    id,
    message: fields.status === 'published' ? 'Announcement published.' : 'Draft saved.',
  };
}
