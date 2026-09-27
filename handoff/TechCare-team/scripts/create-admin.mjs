import nextEnv from '@next/env';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { passwordHash } from '../src/lib/server/auth.mjs';
import { run, now, closeDatabases } from '../src/lib/server/db.mjs';
import { email, password, text } from '../src/lib/server/validation.mjs';
nextEnv.loadEnvConfig(process.cwd());
let muted = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!muted) process.stdout.write(chunk, encoding);
    callback();
  },
});
const input = createInterface({ input: process.stdin, output, terminal: true });
try {
  const name = text(await input.question('Administrator display name: '), 'Name', 2, 80);
  const address = email(await input.question('Administrator email: '));
  process.stdout.write('Password (12 to 128 characters, hidden): ');
  muted = true;
  const pw = password(await input.question(''));
  muted = false;
  process.stdout.write('\n');
  run(
    "INSERT INTO users(name,email,hash,role,verified,created) VALUES(?,?,?,'admin',1,?)",
    name,
    address,
    passwordHash(pw),
    now(),
  );
  console.log('Administrator created. Sign in through the application.');
} catch {
  console.error('Administrator could not be created. Check the input and existing account.');
  process.exitCode = 1;
} finally {
  muted = false;
  input.close();
  closeDatabases();
}
