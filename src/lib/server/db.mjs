import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { guides, defaultBooth } from '../content-defaults.mjs';

export const dataDir = () =>
  resolve(/* turbopackIgnore: true */ process.env.TECHCARE_DATA_DIR || './data');
const schema = `
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','moderator','admin')), bio TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL, visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','private')), verified INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS email_verifications(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, code_hash TEXT NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, last_sent INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS follows(follower INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, followed INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(follower,followed), CHECK(follower != followed));
CREATE TABLE IF NOT EXISTS posts(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL, body TEXT NOT NULL, category TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','published','rejected')), created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id), body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','published','rejected')), created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS resources(id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, type TEXT NOT NULL, url TEXT NOT NULL, author TEXT NOT NULL, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), message TEXT NOT NULL, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS lost_found(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), kind TEXT NOT NULL CHECK(kind IN ('lost','found')), item TEXT NOT NULL, details TEXT NOT NULL, location TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','published','rejected')), created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS friendships(sender INTEGER NOT NULL REFERENCES users(id), receiver INTEGER NOT NULL REFERENCES users(id), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted')), created INTEGER NOT NULL, PRIMARY KEY(sender,receiver), CHECK(sender != receiver));
CREATE UNIQUE INDEX IF NOT EXISTS friendship_pair ON friendships(min(sender,receiver),max(sender,receiver));
CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY, sender INTEGER NOT NULL REFERENCES users(id), receiver INTEGER NOT NULL REFERENCES users(id), body TEXT NOT NULL, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS password_resets(token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS media(name TEXT PRIMARY KEY, owner INTEGER NOT NULL REFERENCES users(id), access TEXT NOT NULL CHECK(access IN ('profile','public')), mime TEXT NOT NULL, bytes INTEGER NOT NULL, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, actor INTEGER NOT NULL REFERENCES users(id), action TEXT NOT NULL, kind TEXT NOT NULL, target INTEGER NOT NULL, reason TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS blocks(blocker INTEGER NOT NULL REFERENCES users(id), blocked INTEGER NOT NULL REFERENCES users(id), created INTEGER NOT NULL, PRIMARY KEY(blocker,blocked), CHECK(blocker != blocked));
CREATE TABLE IF NOT EXISTS message_reports(id INTEGER PRIMARY KEY, reporter INTEGER NOT NULL REFERENCES users(id), message_id INTEGER NOT NULL REFERENCES messages(id), reason TEXT NOT NULL, created INTEGER NOT NULL, UNIQUE(reporter,message_id));
CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY, applied INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS post_status_time ON posts(status,created DESC,id DESC);
CREATE INDEX IF NOT EXISTS comment_parent_status ON comments(post_id,status,created);
CREATE INDEX IF NOT EXISTS message_pair ON messages(sender,receiver,id);
CREATE INDEX IF NOT EXISTS session_user ON sessions(user_id);
`;

// Recheck cached connections after a development module reload introduces a migration.
const migratedConnections = new WeakSet();
export function db() {
  const path = resolve(dataDir(), 'techcare.sqlite3');
  globalThis.__techcareDBs ||= new Map();
  const cached = globalThis.__techcareDBs.get(path);
  if (cached) {
    if (migratedConnections.has(cached)) return cached;
    if (cached.prepare('SELECT 1 FROM migrations WHERE version=5').get()) {
      migratedConnections.add(cached);
      return cached;
    }
    cached.close();
    globalThis.__techcareDBs.delete(path);
  }
  mkdirSync(dataDir(), { recursive: true });
  const con = new DatabaseSync(path);
  con.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  const exists = con.prepare("SELECT name FROM sqlite_master WHERE name='users'").get();
  if (exists && !con.prepare("SELECT name FROM sqlite_master WHERE name='migrations'").get()) {
    con.close();
    throw new Error('Legacy database requires explicit migration. See docs/MIGRATION.md.');
  }
  con.exec(schema);
  if (
    !con.prepare('SELECT 1 FROM migrations WHERE version=1').get() &&
    !con.prepare('SELECT 1 FROM resources').get()
  ) {
    const insert = con.prepare(
      'INSERT INTO resources(title,description,category,type,url,author,created) VALUES(?,?,?,?,?,?,?)',
    );
    const time = Math.floor(Date.now() / 1000);
    insert.run(
      'Fix Wi-Fi connection problems in Windows',
      'A specific video tutorial covering basic Wi-Fi troubleshooting. Review before following the steps.',
      'Connectivity',
      'external',
      'https://www.youtube.com/watch?v=xgVBNxeH-KU',
      'Sertilink IT',
      time,
    );
    insert.run(
      'Five ways to care for your laptop',
      'A sample device-care flyer for student review before distribution.',
      'Hardware',
      'image',
      '/static/device-care-guide.png',
      'Project TechCare template',
      time,
    );
  }
  con.prepare('INSERT OR IGNORE INTO migrations VALUES(1,?)').run(Math.floor(Date.now() / 1000));
  // Upgrade existing pilots without changing their posts or uploaded media.
  con.exec('BEGIN IMMEDIATE');
  try {
    if (!con.prepare('SELECT 1 FROM migrations WHERE version=2').get()) {
      con.exec(`
        ALTER TABLE posts ADD COLUMN photo TEXT NOT NULL DEFAULT '';
        CREATE TABLE media_v2(name TEXT PRIMARY KEY, owner INTEGER NOT NULL REFERENCES users(id), access TEXT NOT NULL CHECK(access IN ('profile','public','question')), mime TEXT NOT NULL, bytes INTEGER NOT NULL, created INTEGER NOT NULL);
        INSERT INTO media_v2 SELECT * FROM media;
        DROP TABLE media;
        ALTER TABLE media_v2 RENAME TO media;
        CREATE INDEX post_photo ON posts(photo) WHERE photo != '';
      `);
      con.prepare('INSERT INTO migrations VALUES(2,?)').run(Math.floor(Date.now() / 1000));
    }
    if (!con.prepare('SELECT 1 FROM migrations WHERE version=3').get()) {
      con.exec(`
        CREATE TABLE announcements (
          id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
          image TEXT NOT NULL, alt TEXT NOT NULL, date TEXT NOT NULL DEFAULT '', link TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
          position INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 1, created INTEGER NOT NULL
        );
        ALTER TABLE media RENAME TO media_before_announcements;
        CREATE TABLE media(name TEXT PRIMARY KEY, owner INTEGER NOT NULL REFERENCES users(id), access TEXT NOT NULL CHECK(access IN ('profile','public','question','announcement')), mime TEXT NOT NULL, bytes INTEGER NOT NULL, created INTEGER NOT NULL);
        INSERT INTO media SELECT * FROM media_before_announcements;
        DROP TABLE media_before_announcements;
      `);
      con.prepare('INSERT INTO migrations VALUES(3,?)').run(Math.floor(Date.now() / 1000));
    }
    if (!con.prepare('SELECT 1 FROM migrations WHERE version=4').get()) {
      con.exec(`
        CREATE TABLE guides(id INTEGER PRIMARY KEY, title TEXT NOT NULL, summary TEXT NOT NULL,
          category TEXT NOT NULL, time TEXT NOT NULL, icon TEXT NOT NULL, steps TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
          revision INTEGER NOT NULL DEFAULT 1, created INTEGER NOT NULL);
        CREATE TABLE booths(id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
          label TEXT NOT NULL, date TEXT NOT NULL, dateNote TEXT NOT NULL, venue TEXT NOT NULL,
          hours TEXT NOT NULL, image TEXT NOT NULL, alt TEXT NOT NULL, steps TEXT NOT NULL,
          preparation TEXT NOT NULL, safety TEXT NOT NULL, note TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
          revision INTEGER NOT NULL DEFAULT 1, created INTEGER NOT NULL);
        ALTER TABLE resources ADD COLUMN status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published'));
        ALTER TABLE resources ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE media RENAME TO media_before_managed_content;
        CREATE TABLE media(name TEXT PRIMARY KEY, owner INTEGER NOT NULL REFERENCES users(id),
          access TEXT NOT NULL CHECK(access IN ('profile','public','question','announcement','managed')),
          mime TEXT NOT NULL, bytes INTEGER NOT NULL, created INTEGER NOT NULL);
        INSERT INTO media SELECT * FROM media_before_managed_content;
        DROP TABLE media_before_managed_content;
        UPDATE media SET access='managed' WHERE access='public'
          AND '/api/media/' || name IN (SELECT url FROM resources)
          AND '/api/media/' || name NOT IN (SELECT value FROM settings);
      `);
      const time = Math.floor(Date.now() / 1000);
      for (const g of guides) {
        con
          .prepare(
            "INSERT INTO guides(id,title,summary,category,time,icon,steps,status,created) VALUES(?,?,?,?,?,?,?,'published',?)",
          )
          .run(g.id, g.title, g.summary, g.category, g.time, g.icon, JSON.stringify(g.steps), time);
      }
      const b = defaultBooth;
      con
        .prepare(
          "INSERT INTO booths(title,description,label,date,dateNote,venue,hours,image,alt,steps,preparation,safety,note,status,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'published',?)",
        )
        .run(
          b.title,
          b.description,
          b.label,
          b.date,
          b.dateNote,
          b.venue,
          b.hours,
          b.image,
          b.alt,
          JSON.stringify(b.steps),
          JSON.stringify(b.preparation),
          b.safety,
          b.note,
          time,
        );
      con.prepare('INSERT INTO migrations VALUES(4,?)').run(time);
    }
    if (!con.prepare('SELECT 1 FROM migrations WHERE version=5').get()) {
      con.exec(`
        CREATE TABLE post_votes(post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          value INTEGER NOT NULL CHECK(value IN (-1,1)), PRIMARY KEY(post_id,user_id));
        CREATE TABLE comment_votes(comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          value INTEGER NOT NULL CHECK(value IN (-1,1)), PRIMARY KEY(comment_id,user_id));
      `);
      con.prepare('INSERT INTO migrations VALUES(5,?)').run(Math.floor(Date.now() / 1000));
    }
    con.exec('COMMIT');
  } catch (error) {
    con.exec('ROLLBACK');
    con.close();
    throw error;
  }
  globalThis.__techcareDBs.set(path, con);
  migratedConnections.add(con);
  return con;
}
export const one = (sql, ...args) =>
  db()
    .prepare(sql)
    .get(...args);
export const all = (sql, ...args) =>
  db()
    .prepare(sql)
    .all(...args);
export const run = (sql, ...args) =>
  db()
    .prepare(sql)
    .run(...args);
export const now = () => Math.floor(Date.now() / 1000);
export function transaction(fn) {
  const con = db();
  con.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    con.exec('COMMIT');
    return result;
  } catch (error) {
    con.exec('ROLLBACK');
    throw error;
  }
}
export function closeDatabases() {
  for (const con of globalThis.__techcareDBs?.values() || []) con.close();
  globalThis.__techcareDBs?.clear();
}
export { schema };
