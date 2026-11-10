/**
 * Bộ trộn âm thanh thiên nhiên ở cấp ứng dụng: chuyển trang vẫn tiếp tục phát.
 * Mỗi âm thanh là một <audio loop>; âm lượng 0 = tắt. Mức âm lượng ưa thích được nhớ trong LocalStorage.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AMBIENT_SOUNDS, soundSrc } from './ambientSounds';

interface AmbientValue {
  /** id -> âm lượng 0..1 (0 / không có = đang tắt) */
  volumes: Record<string, number>;
  setVolume: (id: string, volume: number) => void;
  toggle: (id: string) => void;
  stopAll: () => void;
  playingCount: number;
}

const KEY = 'smartstudy.v1.ambient';
const DEFAULT_VOLUME = 0.5;
const AmbientContext = createContext<AmbientValue | null>(null);

function readRemembered(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
    return Object.fromEntries(Object.entries(raw).filter((e): e is [string, number] => typeof e[1] === 'number'));
  } catch {
    return {};
  }
}

export function AmbientProvider({ children }: { children: ReactNode }) {
  // Không tự phát khi mở trang (trình duyệt chặn autoplay) – chỉ nhớ mức âm lượng ưa thích
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const remembered = useRef<Record<string, number>>(readRemembered());
  const players = useRef(new Map<string, HTMLAudioElement>());

  useEffect(() => {
    const map = players.current;
    return () => map.forEach((a) => a.pause());
  }, []);

  const player = useCallback((id: string) => {
    let a = players.current.get(id);
    if (!a) {
      const sound = AMBIENT_SOUNDS.find((s) => s.id === id);
      if (!sound) return null;
      a = new Audio(soundSrc(sound));
      a.loop = true;
      players.current.set(id, a);
    }
    return a;
  }, []);

  const setVolume = useCallback(
    (id: string, volume: number) => {
      const v = Math.min(1, Math.max(0, volume));
      const a = player(id);
      if (!a) return;
      a.volume = v;
      if (v > 0 && a.paused) void a.play().catch(() => undefined);
      if (v === 0) a.pause();
      if (v > 0) {
        remembered.current[id] = v;
        try {
          localStorage.setItem(KEY, JSON.stringify(remembered.current));
        } catch {
          /* bỏ qua */
        }
      }
      setVolumes((prev) => ({ ...prev, [id]: v }));
    },
    [player],
  );

  const toggle = useCallback(
    (id: string) => setVolume(id, (volumes[id] ?? 0) > 0 ? 0 : remembered.current[id] ?? DEFAULT_VOLUME),
    [setVolume, volumes],
  );

  const stopAll = useCallback(() => {
    players.current.forEach((a) => a.pause());
    setVolumes({});
  }, []);

  const value = useMemo(
    () => ({ volumes, setVolume, toggle, stopAll, playingCount: Object.values(volumes).filter((v) => v > 0).length }),
    [volumes, setVolume, toggle, stopAll],
  );
  return <AmbientContext.Provider value={value}>{children}</AmbientContext.Provider>;
}

export function useAmbient(): AmbientValue {
  const ctx = useContext(AmbientContext);
  if (!ctx) throw new Error('useAmbient phải nằm trong <AmbientProvider>');
  return ctx;
}
