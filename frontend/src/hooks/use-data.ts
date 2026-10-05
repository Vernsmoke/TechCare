'use client';
import { useEffect, useState } from 'react';
import { api } from '@/services/api';

export function useData<T>(path: string, version = 0, pollMs = 0) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setData(null);
    setError('');
    api<T>(path, undefined, controller.signal)
      .then(setData)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, version, retry]);
  useEffect(() => {
    if (!pollMs) return;
    let active = true;
    let running = false;
    const controller = new AbortController();
    const poll = async () => {
      if (!active || running || document.hidden) return;
      running = true;
      try {
        const next = await api<T>(path, undefined, controller.signal);
        if (active) {
          setData(next);
          setError('');
        }
      } catch (failure) {
        if ((failure as Error).name !== 'AbortError') {
          // Keep the last useful queue visible during a temporary connection issue.
        }
      } finally {
        running = false;
      }
    };
    const timer = window.setInterval(poll, pollMs);
    const onFocus = () => void poll();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [path, version, pollMs]);
  return { data, error, loading, reload: () => setRetry((n) => n + 1) };
}
