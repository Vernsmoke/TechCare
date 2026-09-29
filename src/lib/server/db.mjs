import mysql from 'mysql2/promise';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const transactions = new AsyncLocalStorage();

export const dataDir = () =>
  // CHANGE FOR YOUR DEPLOYMENT: point this at durable/shared media storage
  // before running multiple application instances.
  resolve(/* turbopackIgnore: true */ process.env.TECHCARE_MEDIA_DIR || './data');

function config() {
  // CHANGE FOR YOUR DEPLOYMENT: set TECHCARE_DB_* and pool size in .env.local.
  const port = Number(process.env.TECHCARE_DB_PORT || 3306);
  const connectionLimit = Number(process.env.TECHCARE_DB_POOL_SIZE || 10);
  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !Number.isInteger(connectionLimit) ||
    connectionLimit < 1 ||
    connectionLimit > 100
  )
    throw new Error('Invalid MySQL port or connection-pool size.');
  return {
    host: process.env.TECHCARE_DB_HOST || '127.0.0.1',
    port,
    database: process.env.TECHCARE_DB_NAME || 'techcare',
    // Use a dedicated least-privilege application account in production.
    user: process.env.TECHCARE_DB_USER || 'root',
    password: process.env.TECHCARE_DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit,
    queueLimit: 0,
    charset: 'utf8mb4',
    supportBigNumbers: true,
    bigNumberStrings: false,
    decimalNumbers: true,
  };
}

export function db() {
  globalThis.__techcareMySQLPools ||= new Map();
  const options = config();
  const key = JSON.stringify({
    ...options,
    password: createHash('sha256').update(options.password).digest('hex'),
  });
  let pool = globalThis.__techcareMySQLPools.get(key);
  if (!pool) {
    pool = mysql.createPool(options);
    globalThis.__techcareMySQLPools.set(key, pool);
  }
  return pool;
}

function connection() {
  return transactions.getStore() || db();
}

export async function one(sql, ...args) {
  const [rows] = await connection().execute(sql, args);
  return rows[0];
}

export async function all(sql, ...args) {
  const [rows] = await connection().execute(sql, args);
  return rows;
}

export async function run(sql, ...args) {
  const runner = /^\s*(CREATE|DROP)\s+TRIGGER\b/i.test(sql) ? 'query' : 'execute';
  const [result] = await connection()[runner](sql, args);
  return {
    ...result,
    changes: result.affectedRows,
    lastInsertRowid: result.insertId,
  };
}

export const now = () => Math.floor(Date.now() / 1000);

export async function transaction(fn) {
  const con = await db().getConnection();
  let active = false;
  try {
    await con.beginTransaction();
    active = true;
    const result = await transactions.run(con, fn);
    await con.commit();
    active = false;
    return result;
  } catch (error) {
    if (active) {
      try {
        await con.rollback();
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          'The MySQL transaction failed and could not be rolled back.',
        );
      }
    }
    throw error;
  } finally {
    con.release();
  }
}

export async function closeDatabases() {
  const pools = globalThis.__techcareMySQLPools;
  if (!pools) return;
  await Promise.all([...pools.values()].map((pool) => pool.end()));
  pools.clear();
}
