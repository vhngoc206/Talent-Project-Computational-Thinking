import { useEffect, useState } from 'react';

/** Trả về thời điểm hiện tại và tự cập nhật định kỳ để màu deadline/đếm ngược luôn đúng. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
