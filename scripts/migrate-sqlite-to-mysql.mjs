import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import nextEnv from '@next/env';
import {
  closeMySQLPool,
  dataDir,
  getMySQLPool,
  assertDatabaseConfig,
} from '../backend/src/config/db.mjs';
import { getObject, putObject, removeObject } from '../backend/src/services/object-storage.mjs';

nextEnv.loadEnvConfig(process.cwd());

const tableNames = [
  'users',
  'email_verifications',
  'sessions',
  'follows',
  'posts',
  'comments',
  'resources',
  'feedback',
  'lost_found',
  'friendships',
  'messages',
  'settings',
  'password_resets',
  'media',
  'audit',
  'blocks',
  'message_reports',
  'rate_limits',
  'announcements',
  'guides',
  'booths',
  'post_votes',
  'comment_votes',
  'notifications',
  'content_reports',
  'item_inquiries',
];
const quote = (identifier) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) throw new Error('Unexpected database identifier.');
  return `\`${identifier}\``;
};
const sourcePath = resolve(process.env.TECHCARE_SQLITE_FILE || join(dataDir(), 'techcare.sqlite3'));
const applying = process.argv.includes('--apply');
const copiedObjects = [];
process.env.TECHCARE_DB_DRIVER = 'mysql';
assertDatabaseConfig();

let source;
let connection;
try {
  source = new DatabaseSync(sourcePath, { readOnly: true });
  source.exec('PRAGMA query_only=ON;');
  const versions = source.prepare('SELECT version FROM migrations ORDER BY version').all();
  if (!versions.some((row) => row.version === 7))
    throw new Error(
      'The SQLite source must be upgraded through migration version 7 before cutover.',
    );
  const missingTables = tableNames.filter(
    (table) =>
      !source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table),
  );
  if (missingTables.length)
    throw new Error(
      `The SQLite database is missing latest-version tables: ${missingTables.join(', ')}.`,
    );

  const pool = await getMySQLPool();
  connection = await pool.getConnection();
  const [schemaRows] = await connection.execute(
    'SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE()',
  );
  const schemaTables = new Set(schemaRows.map((row) => row.TABLE_NAME || row.table_name));
  const missingSchema = [...tableNames, 'migrations'].filter((table) => !schemaTables.has(table));
  if (missingSchema.length)
    throw new Error(
      `Apply backend/schema/mysql.sql first; target tables are missing: ${missingSchema.join(', ')}.`,
    );
  const [currentVersion] = await connection.execute(
    'SELECT version FROM migrations WHERE version=7 LIMIT 1',
  );
  if (!currentVersion.length)
    throw new Error(
      'The MySQL schema is not at migration version 7. Apply backend/schema/mysql.sql first.',
    );

  const counts = {};
  for (const table of tableNames) {
    counts[table] = source.prepare(`SELECT COUNT(*) AS n FROM ${quote(table)}`).get().n;
    const [targetRows] = await connection.execute(`SELECT COUNT(*) AS n FROM ${quote(table)}`);
    if (Number(targetRows[0].n) !== 0)
      throw new Error(
        `Target table ${table} is not empty. Migration is one-time and will not merge or overwrite data.`,
      );
  }
  const mediaRows = source.prepare('SELECT name,bytes,mime FROM media ORDER BY name').all();
  const hasB2 = [
    'TECHCARE_B2_BUCKET',
    'TECHCARE_B2_ENDPOINT',
    'TECHCARE_B2_REGION',
    'TECHCARE_B2_KEY_ID',
    'TECHCARE_B2_APPLICATION_KEY',
  ].every((key) => process.env[key]);
  if (applying && process.env.NODE_ENV === 'production' && mediaRows.length && !hasB2)
    throw new Error(
      'Configure all TECHCARE_B2_* values before migrating existing media into production.',
    );

  const assets = [];
  for (const media of mediaRows) {
    const key = `media/${media.name}`;
    let bytes;
    let alreadyInObjectStorage = false;
    try {
      bytes = await getObject(key);
      alreadyInObjectStorage = true;
    } catch {
      try {
        bytes = await readFile(join(dataDir(), key));
        alreadyInObjectStorage = !hasB2;
      } catch {
        throw new Error(
          `Media object ${media.name} is missing from object storage and ${dataDir()}.`,
        );
      }
    }
    if (bytes.length !== media.bytes)
      throw new Error(
        `Media size mismatch for ${media.name}: database=${media.bytes}, object=${bytes.length}.`,
      );
    assets.push({ key, bytes, mime: media.mime, alreadyInObjectStorage });
  }

  console.log(`SQLite source: ${sourcePath}`);
  console.log(`Target MySQL database: ${process.env.TECHCARE_DB_NAME}`);
  console.log(`Validated ${tableNames.length} tables and ${mediaRows.length} media objects.`);
  for (const [table, count] of Object.entries(counts))
    if (count) console.log(`  ${table}: ${count}`);
  if (!applying) {
    console.log(
      'Dry run only; no rows or media were changed. Re-run with --apply to perform the cutover.',
    );
  } else {
    if (mediaRows.length) {
      for (const asset of assets) {
        if (!asset.alreadyInObjectStorage) {
          await putObject(asset.key, asset.bytes, asset.mime);
          copiedObjects.push(asset.key);
        }
      }
    }
    await connection.beginTransaction();
    try {
      const imported = {};
      for (const table of tableNames) {
        if (table === 'sessions') {
          imported[table] = 0;
          console.log('  sessions: revoked during JWT cutover; members must sign in again');
          continue;
        }
        const sourceColumns = source.prepare(`PRAGMA table_info(${quote(table)})`).all();
        const [targetColumns] = await connection.query(`SHOW COLUMNS FROM ${quote(table)}`);
        const writable = targetColumns
          .filter((column) => !String(column.Extra || column.extra || '').includes('GENERATED'))
          .map((column) => column.Field || column.field);
        const columns = sourceColumns.map((column) => column.name);
        const absent = columns.filter((column) => !writable.includes(column));
        if (absent.length)
          throw new Error(`Target table ${table} lacks source columns: ${absent.join(', ')}.`);
        const primary = sourceColumns
          .filter((column) => column.pk)
          .sort((a, b) => a.pk - b.pk)
          .map((column) => column.name);
        if (!primary.length) throw new Error(`Source table ${table} has no primary key.`);
        const statement = source.prepare(
          `SELECT ${columns.map(quote).join(',')} FROM ${quote(table)} ORDER BY ${primary.map(quote).join(',')}`,
        );
        const iterator = statement.iterate();
        const batchLimit = Math.max(1, Math.floor(60000 / columns.length));
        let batch = [];
        let inserted = 0;
        const verifyBatch = async (rows) => {
          if (!rows.length) return;
          const tuple = `(${primary.map(quote).join(',')})`;
          const values = rows.flatMap((row) => primary.map((key) => row[key]));
          const rowValue = `(${primary.map(() => '?').join(',')})`;
          const [actualRows] = await connection.execute(
            `SELECT ${columns.map(quote).join(',')} FROM ${quote(table)} WHERE ${tuple} IN (${rows.map(() => rowValue).join(',')})`,
            values,
          );
          if (actualRows.length !== rows.length)
            throw new Error(`Row count verification failed in table ${table}.`);
          const actualByKey = new Map(
            actualRows.map((row) => [JSON.stringify(primary.map((key) => row[key])), row]),
          );
          for (const row of rows) {
            const key = JSON.stringify(primary.map((field) => row[field]));
            const persisted = actualByKey.get(key);
            if (!persisted)
              throw new Error(`Primary key verification failed in table ${table}: ${key}.`);
            const expected = columns.map((field) => row[field]);
            const actual = columns.map((field) => persisted[field]);
            if (JSON.stringify(expected) !== JSON.stringify(actual))
              throw new Error(`Content verification failed in ${table} at primary key ${key}.`);
          }
        };
        const insertBatch = async (rows) => {
          if (!rows.length) return;
          const rowValue = `(${columns.map(() => '?').join(',')})`;
          const params = rows.flatMap((row) => columns.map((column) => row[column]));
          await connection.execute(
            `INSERT INTO ${quote(table)} (${columns.map(quote).join(',')}) VALUES ${rows.map(() => rowValue).join(',')}`,
            params,
          );
          await verifyBatch(rows);
          inserted += rows.length;
        };
        for (const row of iterator) {
          batch.push(row);
          if (batch.length >= batchLimit) {
            await insertBatch(batch);
            batch = [];
          }
        }
        await insertBatch(batch);
        imported[table] = inserted;
      }
      await connection.commit();
      console.log(
        `Import committed; ${Object.values(imported).reduce((sum, count) => sum + count, 0)} rows verified across ${tableNames.length} tables.`,
      );
    } catch (error) {
      await connection.rollback();
      for (const key of copiedObjects.splice(0)) await removeObject(key).catch(() => {});
      throw error;
    }
  }
} catch (error) {
  for (const key of copiedObjects.splice(0)) await removeObject(key).catch(() => {});
  console.error(`SQLite-to-MySQL migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  source?.close();
  connection?.release();
  await closeMySQLPool().catch(() => {});
}
