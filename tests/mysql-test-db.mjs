import nextEnv from '@next/env';
import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export async function initializeTestDatabase() {
  nextEnv.loadEnvConfig(process.cwd());
  const database = `techcare_test_${randomUUID().replaceAll('-', '')}`;
  process.env.TECHCARE_DB_NAME = database;
  const connection = await mysql.createConnection({
    host: process.env.TECHCARE_DB_HOST || '127.0.0.1',
    port: Number(process.env.TECHCARE_DB_PORT || 3306),
    user: process.env.TECHCARE_DB_USER || 'root',
    password: process.env.TECHCARE_DB_PASSWORD || '',
    multipleStatements: true,
  });
  try {
    const sql = await readFile(new URL('../database.sql', import.meta.url), 'utf8');
    await connection.query(sql.replaceAll('techcare', database));
  } finally {
    await connection.end();
  }
  return async () => {
    const { closeDatabases } = await import('../src/lib/server/db.mjs');
    await closeDatabases();
    const admin = await mysql.createConnection({
      host: process.env.TECHCARE_DB_HOST || '127.0.0.1',
      port: Number(process.env.TECHCARE_DB_PORT || 3306),
      user: process.env.TECHCARE_DB_USER || 'root',
      password: process.env.TECHCARE_DB_PASSWORD || '',
    });
    try {
      await admin.query(`DROP DATABASE \`${database}\``);
    } finally {
      await admin.end();
    }
  };
}
