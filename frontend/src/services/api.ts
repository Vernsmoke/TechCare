import type { FormValues } from '@shared/types';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  data?: FormValues | Record<string, unknown>,
  signal?: AbortSignal,
  progress?: (value: number) => void,
): Promise<T> {
  signal?.throwIfAborted();
  if (data && progress)
    return new Promise<T>((resolve, reject) => {
      const request = new XMLHttpRequest();
      const abort = () => request.abort();
      const cleanup = () => signal?.removeEventListener('abort', abort);
      const fail = (error: Error) => {
        cleanup();
        reject(error);
      };
      request.open('POST', `/api/${path}`);
      request.timeout = 120_000;
      request.setRequestHeader('Content-Type', 'application/json');
      request.setRequestHeader('X-TechCare-Request', '1');
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) progress(Math.round((event.loaded / event.total) * 100));
      };
      request.onerror = () =>
        fail(new Error('Upload interrupted. Check your connection and try again.'));
      request.onabort = () => fail(new DOMException('Upload cancelled.', 'AbortError'));
      request.ontimeout = () =>
        fail(new Error('Upload timed out. Check whether it was saved before trying again.'));
      request.onload = () => {
        cleanup();
        try {
          const result = JSON.parse(request.responseText);
          if (request.status >= 200 && request.status < 300) resolve(result);
          else {
            if (result.code === 'CONSENT_REQUIRED')
              window.dispatchEvent(new Event('techcare-consent-required'));
            if (request.status === 401 && !['login', 'register', 'verify'].includes(path))
              window.dispatchEvent(new Event('techcare-session-expired'));
            reject(new ApiError(result.error || 'Could not save. Try again.', request.status));
          }
        } catch {
          reject(new Error('Could not read the server response. Try again.'));
        }
      };
      signal?.addEventListener('abort', abort, { once: true });
      try {
        request.send(JSON.stringify(data));
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  const response = await fetch(`/api/${path}`, {
    method: data ? 'POST' : 'GET',
    cache: 'no-store',
    headers: data ? { 'Content-Type': 'application/json', 'X-TechCare-Request': '1' } : undefined,
    body: data ? JSON.stringify(data) : undefined,
    signal,
  });
  const result = await response.json();
  if (!response.ok) {
    if (result.code === 'CONSENT_REQUIRED')
      window.dispatchEvent(new Event('techcare-consent-required'));
    if (response.status === 401 && !['login', 'register', 'verify'].includes(path))
      window.dispatchEvent(new Event('techcare-session-expired'));
    throw new ApiError(result.error || 'Something went wrong. Try again.', response.status);
  }
  return result;
}
