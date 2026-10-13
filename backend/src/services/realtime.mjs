import { WebSocket, WebSocketServer } from 'ws';

const realtimeState = (globalThis[Symbol.for('techcare.realtime')] ??= { server: undefined });

export function attachRealtime(server, expectedOrigin, nextUpgradeHandler) {
  const sockets = new WebSocketServer({
    noServer: true,
    maxPayload: 1024,
    perMessageDeflate: false,
  });
  let heartbeat;

  const upgrade = (request, socket, head) => {
    let path;
    try {
      path = new URL(request.url, expectedOrigin).pathname;
    } catch {
      socket.destroy();
      return;
    }

    if (path !== '/ws') {
      void nextUpgradeHandler(request, socket, head).catch((error) => {
        console.error('TechCare protocol upgrade failed:', error?.message || 'internal error');
        socket.destroy();
      });
      return;
    }

    if (request.headers.origin !== expectedOrigin) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    sockets.handleUpgrade(request, socket, head, (connection) => {
      sockets.emit('connection', connection, request);
    });
  };

  sockets.on('connection', (connection) => {
    connection.isAlive = true;
    connection.on('pong', () => {
      connection.isAlive = true;
    });
    connection.on('message', () => {
      connection.close(1008, 'This connection is read-only.');
    });
    connection.on('error', (error) => {
      console.error('TechCare WebSocket error:', error.message);
    });
  });

  heartbeat = setInterval(() => {
    for (const connection of sockets.clients) {
      if (connection.readyState !== WebSocket.OPEN) continue;
      if (!connection.isAlive) {
        connection.terminate();
        continue;
      }
      connection.isAlive = false;
      connection.ping();
    }
  }, 30_000);
  heartbeat.unref();
  server.on('upgrade', upgrade);
  realtimeState.server = sockets;

  return () => {
    clearInterval(heartbeat);
    server.off('upgrade', upgrade);
    for (const connection of sockets.clients) connection.close(1001, 'Server shutting down.');
    sockets.close();
    if (realtimeState.server === sockets) realtimeState.server = undefined;
  };
}

export function publishRealtime(type = 'invalidate') {
  if (!['invalidate', 'session', 'settings'].includes(type))
    throw new TypeError('Unsupported real-time event type.');

  if (!realtimeState.server) return;
  const message = JSON.stringify({ type });
  for (const connection of realtimeState.server.clients) {
    if (connection.readyState !== WebSocket.OPEN) continue;
    connection.send(message, (error) => {
      if (error) console.error('TechCare WebSocket delivery failed:', error.message);
    });
  }
}

export function isRealtimeAvailable() {
  return Boolean(realtimeState.server);
}
