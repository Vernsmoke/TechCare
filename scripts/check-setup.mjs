import nextEnv from '@next/env';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateLocalSetup } from './setup-config.mjs';

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
  console.log(`Setup OK. Open exactly ${process.env.TECHCARE_ORIGIN}`);
  console.log('Use that same address for Accept and continue, sign-in, and uploads.');
}
