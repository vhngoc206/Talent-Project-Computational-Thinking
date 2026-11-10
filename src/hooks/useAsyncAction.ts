import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Quản lý trạng thái Loading / Error / Retry cho một thao tác bất đồng bộ (gọi AI).
 * - run(fn): chạy và ghi nhớ fn để retry() gọi lại đúng thao tác đó.
 * - Bỏ qua kết quả của lần gọi cũ nếu người dùng đã bấm lại (tránh hiển thị nhầm).
 */
export function useAsyncAction<T>() {
  const [status, setStatus] = useState<AsyncStatus>('idle');
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const lastFn = useRef<(() => Promise<T>) | null>(null);
  const callId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (fn: () => Promise<T>): Promise<T | null> => {
    lastFn.current = fn;
    const id = ++callId.current;
    setStatus('loading');
    setError(null);
    try {
      const value = await fn();
      if (mounted.current && id === callId.current) {
        setResult(value);
        setStatus('success');
      }
      return value;
    } catch (err) {
      if (mounted.current && id === callId.current) {
        setError(err);
        setStatus('error');
      }
      return null;
    }
  }, []);

  const retry = useCallback(() => (lastFn.current ? run(lastFn.current) : Promise.resolve(null)), [run]);
  const reset = useCallback(() => {
    callId.current++;
    setStatus('idle');
    setResult(null);
    setError(null);
  }, []);

  return { status, result, error, run, retry, reset };
}
