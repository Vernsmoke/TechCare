import { all, one, run, now, transaction } from '../config/db.mjs';
import { Problem, requireUser, blocked, throttle } from '../middleware/auth.mjs';
import * as v from '../validations/validation.mjs';
import { saveMedia, discardCommunityMedia } from './media.mjs';
import { voteColumns } from './discussion.mjs';

const staff = ['admin', 'moderator'];
export function publishedComment(id) {
  return one(
    `SELECT c.* FROM comments c JOIN posts p ON p.id=c.post_id
    LEFT JOIN comments root ON root.id=c.root_id WHERE c.id=? AND c.status='published'
    AND p.status='published' AND (c.root_id IS NULL OR root.status='published')`,
    id,
  );
}
export function notifyReply(id) {
  const comment = publishedComment(id);
  if (!comment || !comment.parent_id || comment.deleted) return;
  const parent = one('SELECT user_id FROM comments WHERE id=?', comment.parent_id);
  if (parent && parent.user_id !== comment.user_id && !blocked(parent.user_id, comment.user_id))
    run(
      'INSERT OR IGNORE INTO notifications(user_id,comment_id,created) VALUES(?,?,?)',
      parent.user_id,
      id,
      now(),
    );
}
export function listComments(url, me) {
  const post = v.id(url.searchParams.get('post')),
    page = v.page(url);
  if (!one("SELECT 1 FROM posts WHERE id=? AND status='published'", post))
    throw new Problem('Published discussion not found.', 404);
  const root = url.searchParams.get('root') ? v.id(url.searchParams.get('root')) : null;
  if (root) {
    const target = publishedComment(root);
    if (!target || target.post_id !== post || target.root_id)
      throw new Problem('Comment thread not found.', 404);
  }
  const rows = all(
    `SELECT c.id,c.body,c.photo,c.parent_id,c.root_id,c.deleted,c.revision,c.created,
    c.user_id=? AS own,u.name,u.role,CASE WHEN u.visibility='private' THEN '' ELSE u.avatar END AS avatar,
    ${voteColumns('comment', 'c')},parentUser.name AS replyTo,
    (SELECT count(*) FROM comments child WHERE child.root_id=c.id AND child.status='published') AS replies
    FROM comments c JOIN users u ON u.id=c.user_id LEFT JOIN comments parent ON parent.id=c.parent_id
    LEFT JOIN users parentUser ON parentUser.id=parent.user_id
    WHERE c.post_id=? AND c.status='published' AND ${root ? 'c.root_id=?' : 'c.root_id IS NULL'}
    ORDER BY c.created,c.id LIMIT 21 OFFSET ?`,
    me?.id || 0,
    me?.id || 0,
    post,
    ...(root ? [root] : []),
    page.offset,
  );
  return {
    comments: rows.slice(0, 20),
    hasMore: rows.length > 20,
    page: page.number,
    rootCount: one(
      "SELECT count(*) AS n FROM comments WHERE post_id=? AND root_id IS NULL AND status='published'",
      post,
    ).n,
  };
}
export async function saveComment(d, me) {
  requireUser(me);
  const editing = d.id ? one('SELECT * FROM comments WHERE id=?', v.id(d.id)) : null;
  if (d.id && (!editing || editing.user_id !== me.id || editing.deleted))
    throw new Problem('You can edit only your own comments.', 403);
  if (editing && Number(d.revision) !== editing.revision)
    throw new Problem('This comment changed. Refresh before editing again.', 409);
  const post = editing?.post_id || v.id(d.post_id);
  const validateParent = () => {
    if (!one("SELECT 1 FROM posts WHERE id=? AND status='published'", post))
      throw new Problem('Reply to a published discussion.', 404);
    const parentId = editing?.parent_id || (d.parent_id ? v.id(d.parent_id) : null);
    const parent = parentId ? publishedComment(parentId) : null;
    if (parentId && (!parent || parent.post_id !== post || (!editing && parent.deleted)))
      throw new Problem('Reply to an available comment in this discussion.', 404);
    return parent;
  };
  validateParent();
  const removing = d.action === 'delete';
  const body = removing
    ? ''
    : v.text(
        d.body || '',
        'Comment',
        d.file || (editing?.photo && d.removePhoto !== '1') ? 0 : 3,
        1000,
      );
  const status = removing ? editing?.status : staff.includes(me.role) ? 'published' : 'pending';
  if (removing && !editing) throw new Problem('Choose your comment.');
  let uploaded = '';
  let photo = removing || d.removePhoto === '1' ? '' : editing?.photo || '';
  if (d.file && !removing) photo = uploaded = await saveMedia(d.file, me.id, 'comment');
  let id;
  try {
    transaction(() => {
      const parent = validateParent();
      if (editing) {
        const result = run(
          'UPDATE comments SET body=?,photo=?,status=?,deleted=?,revision=revision+1 WHERE id=? AND revision=?',
          body,
          photo,
          status,
          removing ? 1 : 0,
          editing.id,
          editing.revision,
        );
        if (!result.changes)
          throw new Problem('This comment changed. Refresh before editing again.', 409);
        id = editing.id;
      } else
        id = Number(
          run(
            'INSERT INTO comments(post_id,user_id,body,status,created,photo,parent_id,root_id) VALUES(?,?,?,?,?,?,?,?)',
            post,
            me.id,
            body,
            status,
            now(),
            photo,
            parent?.id || null,
            parent?.root_id || parent?.id || null,
          ).lastInsertRowid,
        );
      if (status === 'published' && !removing) notifyReply(id);
    });
  } catch (error) {
    if (uploaded) await discardCommunityMedia(uploaded, me.id);
    throw error;
  }
  if (editing?.photo && editing.photo !== photo) await discardCommunityMedia(editing.photo, me.id);
  return {
    id,
    message: removing
      ? 'Comment removed. Existing replies are kept.'
      : status === 'published'
        ? 'Comment published.'
        : 'Comment submitted for moderator review.',
  };
}
export async function saveLost(d, me) {
  requireUser(me);
  const kind = v.choice(d.kind, ['lost', 'found'], 'report type');
  const item = v.text(d.item, 'Item name', 3, 100),
    details = v.publicDescription(d.details),
    location = v.text(d.location, 'Location', 3, 100);
  const eventDate = v.text(d.event_date || '', 'Date', 0, 10);
  if (
    eventDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) ||
      !Number.isFinite(Date.parse(eventDate)) ||
      new Date(eventDate).toISOString().slice(0, 10) !== eventDate)
  )
    throw new Problem('Choose a valid date.');
  const photos = [];
  try {
    for (let i = 0; i < 4; i++)
      if (d[`photo${i}`]) photos.push(await saveMedia(d[`photo${i}`], me.id, 'lost'));
    const id = Number(
      run(
        'INSERT INTO lost_found(user_id,kind,item,details,location,created,photos,event_date) VALUES(?,?,?,?,?,?,?,?)',
        me.id,
        kind,
        item,
        details,
        location,
        now(),
        JSON.stringify(photos),
        eventDate,
      ).lastInsertRowid,
    );
    return { id, message: 'Your report and photos have been submitted for review.' };
  } catch (error) {
    for (const url of photos) await discardCommunityMedia(url, me.id);
    throw error;
  }
}
export function communityGet(path, url, me) {
  if (path === 'notifications') {
    requireUser(me);
    return {
      notifications: all(
        `SELECT n.id,n.seen,c.post_id,c.id AS comment_id,c.root_id,u.name,p.title,
      1+(SELECT count(*) FROM comments earlier WHERE earlier.post_id=c.post_id AND earlier.root_id IS NULL AND earlier.status='published' AND (earlier.created<root.created OR (earlier.created=root.created AND earlier.id<root.id)))/20 AS page FROM notifications n
      JOIN comments c ON c.id=n.comment_id JOIN users u ON u.id=c.user_id JOIN posts p ON p.id=c.post_id
      LEFT JOIN comments root ON root.id=c.root_id WHERE n.user_id=? AND c.status='published' AND c.deleted=0
      AND p.status='published' AND (root.id IS NULL OR root.status='published') ORDER BY n.id DESC LIMIT 50`,
        me.id,
      ),
    };
  }
  if (path === 'content-reports') {
    requireUser(me, staff);
    return {
      reports: all(`SELECT r.*,u.name,CASE WHEN r.kind='post' THEN p.body ELSE c.body END AS body,
      CASE WHEN r.kind='post' THEN p.id ELSE c.post_id END AS post_id
      FROM content_reports r JOIN users u ON u.id=r.reporter LEFT JOIN posts p ON r.kind='post' AND p.id=r.target
      LEFT JOIN comments c ON r.kind='comment' AND c.id=r.target WHERE r.resolved=0 ORDER BY r.id DESC LIMIT 100`),
    };
  }
  if (path === 'item-inquiries') {
    requireUser(me);
    return {
      inquiries: all(
        `SELECT i.id,i.body,i.response,i.report_id,i.created,l.item,u.name,(l.user_id=? OR ?=1) AS canReply FROM item_inquiries i
      JOIN lost_found l ON l.id=i.report_id JOIN users u ON u.id=i.user_id
      WHERE l.user_id=? OR i.user_id=? OR ?=1 ORDER BY i.id DESC LIMIT 100`,
        me.id,
        staff.includes(me.role) ? 1 : 0,
        me.id,
        me.id,
        staff.includes(me.role) ? 1 : 0,
      ),
    };
  }
}
export function communityPost(path, d, me) {
  requireUser(me);
  if (path === 'notifications') {
    run('UPDATE notifications SET seen=1 WHERE user_id=?', me.id);
    return { message: 'Notifications marked as read.' };
  }
  if (path === 'lost-found/returned') {
    const id = v.id(d.id);
    const result = run(
      "UPDATE lost_found SET returned=1 WHERE id=? AND status='published' AND (user_id=? OR ?=1)",
      id,
      me.id,
      staff.includes(me.role) ? 1 : 0,
    );
    if (!result.changes)
      throw new Problem('Only the reporter or staff can mark this item returned.', 403);
    return { message: 'Item marked as returned.' };
  }
  if (path === 'item-inquiries') {
    throttle(`inquiries:${me.id}`, 10, 3600);
    const report = one(
      "SELECT * FROM lost_found WHERE id=? AND status='published' AND returned=0",
      v.id(d.id),
    );
    if (!report || blocked(me.id, report.user_id))
      throw new Problem('This notice is unavailable.', 404);
    const body = v.text(d.body, 'Message', 10, 1000);
    run(
      'INSERT INTO item_inquiries(report_id,user_id,body,created) VALUES(?,?,?,?)',
      report.id,
      me.id,
      body,
      now(),
    );
    return { message: 'Message sent privately to the reporter and project team.' };
  }
  if (path === 'item-inquiries/reply') {
    const inquiry = one(
      'SELECT i.id,i.user_id,l.user_id AS owner FROM item_inquiries i JOIN lost_found l ON l.id=i.report_id WHERE i.id=?',
      v.id(d.id),
    );
    if (
      !inquiry ||
      !(inquiry.owner === me.id || staff.includes(me.role)) ||
      blocked(inquiry.user_id, me.id)
    )
      throw new Problem('You cannot reply to this inquiry.', 403);
    run(
      'UPDATE item_inquiries SET response=? WHERE id=?',
      v.text(d.response, 'Reply', 3, 1000),
      inquiry.id,
    );
    return { message: 'Private reply saved.' };
  }
  if (path === 'content-reports') {
    throttle(`content-reports:${me.id}`, 20, 3600);
    const kind = v.choice(d.kind, ['post', 'comment'], 'content type'),
      id = v.id(d.id);
    const target =
      kind === 'post'
        ? one("SELECT id FROM posts WHERE id=? AND status='published'", id)
        : publishedComment(id);
    if (!target || target.deleted) throw new Problem('Published content not found.', 404);
    run(
      'INSERT INTO content_reports(reporter,kind,target,reason,created) VALUES(?,?,?,?,?) ON CONFLICT(reporter,kind,target) DO UPDATE SET reason=excluded.reason,resolved=0',
      me.id,
      kind,
      id,
      v.text(d.reason, 'Reason', 5, 500),
      now(),
    );
    return { message: 'Report sent to the moderation team.' };
  }
  if (path === 'content-reports/resolve') {
    requireUser(me, staff);
    const report = one('SELECT * FROM content_reports WHERE id=? AND resolved=0', v.id(d.id));
    if (!report) throw new Problem('Report already resolved.', 409);
    const action = v.choice(d.action, ['dismiss', 'remove'], 'decision');
    transaction(() => {
      if (action === 'remove')
        run(
          `UPDATE ${report.kind === 'post' ? 'posts' : 'comments'} SET status='rejected' WHERE id=?`,
          report.target,
        );
      run(
        'UPDATE content_reports SET resolved=1 WHERE kind=? AND target=?',
        report.kind,
        report.target,
      );
      run(
        'INSERT INTO audit(actor,action,kind,target,reason,created) VALUES(?,?,?,?,?,?)',
        me.id,
        action,
        report.kind,
        report.target,
        report.reason,
        now(),
      );
    });
    return {
      message: action === 'remove' ? 'Content removed from public view.' : 'Report dismissed.',
    };
  }
}
