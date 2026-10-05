import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

// Test the actual browser helper without adding a second TS test runner.
const source = await readFile(new URL('../frontend/src/services/api.ts', import.meta.url), 'utf8');
const compiled = stripTypeScriptTypes(source, { mode: 'transform' });
const { api, ApiError } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

const originalXHR = globalThis.XMLHttpRequest;
const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;
let requests;
class FakeXHR {
  upload = {};
  status = 200;
  responseText = '{"saved":true}';
  headers = {};
  constructor() {
    requests.push(this);
  }
  open(method, url) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name, value) {
    this.headers[name] = value;
  }
  send(body) {
    this.body = body;
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
}
function setup() {
  requests = [];
  globalThis.XMLHttpRequest = FakeXHR;
  globalThis.window = new EventTarget();
}
afterEach(() => {
  globalThis.XMLHttpRequest = originalXHR;
  globalThis.window = originalWindow;
  globalThis.fetch = originalFetch;
});

test('an already cancelled upload sends no request', async () => {
  setup();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    api('media', { file: 'fixture' }, controller.signal, () => {}),
    { name: 'AbortError' },
  );
  assert.equal(requests.length, 0);
});

test('cancelling an in-flight upload aborts transport and settles the promise', async () => {
  setup();
  const controller = new AbortController();
  const promise = api('media', { file: 'fixture' }, controller.signal, () => {});
  controller.abort();
  await assert.rejects(promise, { name: 'AbortError' });
  assert.equal(requests[0].aborted, true);
  assert.equal(requests.length, 1);
});

test('successful upload preserves progress, JSON and CSRF headers, and releases cancellation', async () => {
  setup();
  const controller = new AbortController();
  const progress = [];
  const promise = api('admin/hero', { file: 'fixture' }, controller.signal, (value) =>
    progress.push(value),
  );
  const request = requests[0];
  request.upload.onprogress({ lengthComputable: true, loaded: 1, total: 4 });
  request.onload();
  assert.deepEqual(await promise, { saved: true });
  assert.deepEqual(progress, [25]);
  assert.equal(request.headers['X-TechCare-Request'], '1');
  assert.equal(request.headers['Content-Type'], 'application/json');
  assert.equal(request.method, 'POST');
  assert.equal(request.url, '/api/admin/hero');
  assert.deepEqual(JSON.parse(request.body), { file: 'fixture' });
  controller.abort();
  assert.equal(request.aborted, undefined);
});

test('upload timeout is bounded and never retries a mutation', async () => {
  setup();
  const promise = api('media', { file: 'fixture' }, undefined, () => {});
  assert.equal(requests[0].timeout, 120_000);
  requests[0].ontimeout();
  await assert.rejects(promise, /Check whether it was saved/);
  assert.equal(requests.length, 1);
});

test('network failure and invalid JSON settle with useful errors', async () => {
  setup();
  const failed = api('media', { file: 'fixture' }, undefined, () => {});
  requests[0].onerror();
  await assert.rejects(failed, /Upload interrupted/);
  const invalid = api('media', { file: 'fixture' }, undefined, () => {});
  requests[1].responseText = '<html>upstream error</html>';
  requests[1].onload();
  await assert.rejects(invalid, /Could not read the server response/);
});

test('upload authorization errors retain status and notify the session boundary', async () => {
  setup();
  let expired = 0;
  window.addEventListener('techcare-session-expired', () => expired++);
  const promise = api('media', { file: 'fixture' }, undefined, () => {});
  requests[0].status = 401;
  requests[0].responseText = '{"error":"Please sign in"}';
  requests[0].onload();
  await assert.rejects(promise, (error) => error instanceof ApiError && error.status === 401);
  assert.equal(expired, 1);
});

test('failed login does not expire an unrelated session and consent failures still notify', async () => {
  setup();
  let expired = 0,
    consent = 0;
  window.addEventListener('techcare-session-expired', () => expired++);
  window.addEventListener('techcare-consent-required', () => consent++);
  const login = api('login', { email: 'test@example.test' }, undefined, () => {});
  requests[0].status = 401;
  requests[0].responseText = '{"error":"Invalid login"}';
  requests[0].onload();
  await assert.rejects(login, { status: 401 });
  assert.equal(expired, 0);
  const upload = api('media', { file: 'fixture' }, undefined, () => {});
  requests[1].status = 403;
  requests[1].responseText = '{"error":"Accept agreements","code":"CONSENT_REQUIRED"}';
  requests[1].onload();
  await assert.rejects(upload, { status: 403 });
  assert.equal(consent, 1);
});

test('GET requests retain no-store and forward cancellation', async () => {
  setup();
  const controller = new AbortController();
  let observed;
  globalThis.fetch = async (url, options) => {
    observed = { url, options };
    return Response.json({ guides: [] });
  };
  assert.deepEqual(await api('guides', undefined, controller.signal), { guides: [] });
  assert.equal(observed.url, '/api/guides');
  assert.equal(observed.options.signal, controller.signal);
  assert.equal(observed.options.cache, 'no-store');
  assert.equal(observed.options.method, 'GET');
});
