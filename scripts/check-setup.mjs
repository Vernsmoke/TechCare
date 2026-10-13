import nextEnv from '@next/env';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateLocalSetup } from './setup-config.mjs';
import { assertDatabaseReady, closeMySQLPool } from '../backend/src/config/db.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
nextEnv.loadEnvConfig(root, true);
const errors = validateLocalSetup(process.env, process.versions.node);
if (!existsSync(new URL('../.env.local', import.meta.url))) {
  errors.unshift('Missing root .env.local. Run npm run setup first.');
}
if (errors.length) {
  console.error(
    'TechCare local setup needs attention:\n' + errors.map((error) => `- ${error}`).join('\n'),
  );
  process.exitCode = 1;
} else {
  try {
    await assertDatabaseReady();
    console.log(`Setup OK. Open exactly ${process.env.TECHCARE_ORIGIN}`);
    console.log('MySQL schema is ready. Use the same address for consent, sign-in, and uploads.');
  } catch (error) {
    console.error(`TechCare cannot connect to its MySQL database: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await closeMySQLPool();
  }
}
