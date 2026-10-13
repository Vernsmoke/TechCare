import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { CONSENT_VERSION } from '../shared/src/consent.mjs';
import { handle } from '../backend/src/controllers/api.mjs';
import { closeDatabases } from '../backend/src/config/db.mjs';
import {
  attachRealtime,
  isRealtimeAvailable,
  publishRealtime,
} from '../backend/src/services/realtime.mjs';

test('same-origin WebSocket clients receive data-free invalidation events', async (t) => {
  const origin = 'http://127.0.0.1';
  const directory = await mkdtemp(join(tmpdir(), 'techcare-realtime-'));
  process.env.TECHCARE_DB_DRIVER = 'sqlite';
  process.env.TECHCARE_TEST_SQLITE = '1';
  process.env.TECHCARE_DATA_DIR = directory;
  process.env.TECHCARE_DEV_VERIFY = '1';
  process.env.TECHCARE_ORIGIN = origin;
  const server = createServer();
  const detach = attachRealtime(server, origin, async (_request, socket) => socket.destroy());
  t.after(async () => {
    detach();
    await new Promise((resolve) => server.close(resolve));
    await closeDatabases();
    await rm(directory, { recursive: true, force: true });
  });
  assert.equal(isRealtimeAvailable(), true);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  const client = new WebSocket(`ws://127.0.0.1:${address.port}/ws`, { origin });
  t.after(() => client.close());
  await once(client, 'open');

  const received = once(client, 'message');
  const response = await handle(
    new Request(`${origin}/api/consent`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin,
        'x-techcare-request': '1',
      },
      body: JSON.stringify({
        terms: true,
        privacy: true,
        version: CONSENT_VERSION,
      }),
    }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse((await received)[0].toString()), { type: 'invalidate' });
});

test('the real-time publisher rejects unknown event types', () => {
  assert.throws(() => publishRealtime('private-data'), /Unsupported real-time event type/);
});
