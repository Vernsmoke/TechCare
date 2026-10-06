import { copyFile, constants } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
try {
  await copyFile(
    new URL('.env.example', root),
    new URL('.env.local', root),
    constants.COPYFILE_EXCL,
  );
  console.log('Created .env.local from .env.example. Existing data and accounts are unchanged.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Kept your existing .env.local. No settings were overwritten.');
}
await import('./check-setup.mjs');
