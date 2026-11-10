/** Tùy chọn giao diện trang Focus (hình nền, video, độ tối) – lưu trong LocalStorage. */
import { useCallback, useEffect, useState } from 'react';
import { GHIBLI_IMAGES } from '../../constants/ghibli';
import type { VideoItem } from './youtube';

export type FocusBackground = { kind: 'image'; id: string } | { kind: 'upload' } | { kind: 'youtube' };

export interface FocusPrefs {
  background: FocusBackground;
  /** Độ tối phủ lên nền để chữ dễ đọc (0..0.7) */
  dim: number;
  /** Video YouTube đang chọn */
  video: VideoItem | null;
  videoVolume: number;
  /** Lặp lại bài đang phát (tắt => phát xong chuyển bài tiếp theo) */
  loop: boolean;
}

const KEY = 'smartstudy.v1.focus';
export const DEFAULT_FOCUS_PREFS: FocusPrefs = {
  background: { kind: 'image', id: 'totoro029' },
  dim: 0.3,
  video: null,
  videoVolume: 0.6,
  loop: true,
};

export function sanitizeFocusPrefs(raw: unknown): FocusPrefs {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const bg = (typeof r.background === 'object' && r.background !== null ? r.background : {}) as Record<string, unknown>;
  let background: FocusBackground = DEFAULT_FOCUS_PREFS.background;
  if (bg.kind === 'image' && typeof bg.id === 'string' && GHIBLI_IMAGES.some((g) => g.id === bg.id)) background = { kind: 'image', id: bg.id };
  else if (bg.kind === 'upload' || bg.kind === 'youtube') background = { kind: bg.kind };

  const v = (typeof r.video === 'object' && r.video !== null ? r.video : null) as Record<string, unknown> | null;
  const video =
    v && typeof v.id === 'string' && /^[\w-]{11}$/.test(v.id)
      ? { id: v.id, title: String(v.title ?? ''), channel: String(v.channel ?? ''), thumbnail: String(v.thumbnail ?? '') }
      : null;
  const num = (x: unknown, min: number, max: number, d: number) => (typeof x === 'number' && x >= min && x <= max ? x : d);
  return {
    // Không còn video thì không thể dùng video làm nền
    background: background.kind === 'youtube' && !video ? DEFAULT_FOCUS_PREFS.background : background,
    dim: num(r.dim, 0, 0.7, DEFAULT_FOCUS_PREFS.dim),
    video,
    videoVolume: num(r.videoVolume, 0, 1, DEFAULT_FOCUS_PREFS.videoVolume),
    loop: r.loop !== false,
  };
}

export function useFocusPrefs() {
  const [prefs, setPrefs] = useState<FocusPrefs>(() => {
    try {
      return sanitizeFocusPrefs(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
    } catch {
      return DEFAULT_FOCUS_PREFS;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* bỏ qua */
    }
  }, [prefs]);
  const update = useCallback((patch: Partial<FocusPrefs>) => setPrefs((p) => ({ ...p, ...patch })), []);
  return [prefs, update] as const;
}
