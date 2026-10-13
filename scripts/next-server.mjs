import nextEnv from '@next/env';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { attachRealtime } from '../backend/src/services/realtime.mjs';

export async function startNextServer(dev) {
  const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
  process.env.NODE_ENV = dev ? 'development' : 'production';
  nextEnv.loadEnvConfig(root, dev);
  process.env.TECHCARE_PROJECT_ROOT = root;
  process.env.TECHCARE_DATA_DIR = resolve(root, process.env.TECHCARE_DATA_DIR || 'data');
  const { default: next } = await import('next');

  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT must be a valid TCP port.');
  const hostname = process.env.TECHCARE_HOST || '127.0.0.1';
  const app = next({
    dev,
    dir: join(root, 'frontend'),
    hostname,
    port,
    webpack: dev,
  });
  await app.prepare();

  const requestHandler = app.getRequestHandler();
  const server = createServer((request, response) => requestHandler(request, response));
  const stopRealtime = attachRealtime(
    server,
    process.env.TECHCARE_ORIGIN,
    app.getUpgradeHandler(),
  );

  try {
    await new Promise((resolveListen, rejectListen) => {
      server.once('error', rejectListen);
      server.listen(port, hostname, resolveListen);
    });
  } catch (error) {
    stopRealtime();
    await app.close();
    throw error;
  }

  console.log(
    `TechCare ${dev ? 'development' : 'production'} server listening on http://${hostname}:${port}`,
  );
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    stopRealtime();
    server.close((error) => {
      if (error) {
        console.error('TechCare server shutdown failed:', error.message);
        process.exitCode = 1;
      }
      void app.close().catch((closeError) => {
        console.error('TechCare Next.js shutdown failed:', closeError?.message || 'internal error');
        process.exitCode = 1;
      });
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  server.once('close', () => {
    process.off('SIGINT', shutdown);
    process.off('SIGTERM', shutdown);
  });
  return server;
}
