/**
 * Pomodoro ở cấp ứng dụng: đồng hồ vẫn chạy khi người dùng chuyển trang.
 * Thời gian dựa trên mốc kết thúc (endAt) thay vì đếm từng giây nên không bị lệch khi tab bị trình duyệt làm chậm.
 * Cài đặt (thời lượng, chuông, tự chạy tiếp…) lưu riêng trong LocalStorage.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useToast } from '../../components/ui/Toast';
import { useAppState } from '../../state/AppStateContext';
import type { Task } from '../../types';
import {
  DEFAULT_POMODORO_SETTINGS,
  formatClock,
  getNextPhase,
  PHASE_LABEL,
  sanitizePomodoroSettings,
  type BellSound,
  type PomodoroPhase,
  type PomodoroSettings,
} from './pomodoroLogic';

export type PomodoroStatus = 'idle' | 'running' | 'paused';

interface PomodoroValue {
  phase: PomodoroPhase;
  status: PomodoroStatus;
  remainingSeconds: number;
  totalSeconds: number;
  completedFocus: number;
  settings: PomodoroSettings;
  taskId: string;
  /** Task đang chọn (undefined nếu chưa chọn / đã bị xóa / đã hoàn thành) */
  activeTask: Task | undefined;
  setTaskId: (id: string) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  /** Bỏ qua pha hiện tại (không ghi nhận giờ học) */
  skip: () => void;
  selectPhase: (phase: PomodoroPhase) => void;
  updateSettings: (patch: Partial<PomodoroSettings>) => void;
  /** Nghe thử chuông */
  testBell: (bell?: BellSound) => void;
}

const SETTINGS_KEY = 'smartstudy.v1.pomodoro';
const PomodoroContext = createContext<PomodoroValue | null>(null);

function loadSettings(): PomodoroSettings {
  try {
    return sanitizePomodoroSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null'));
  } catch {
    return DEFAULT_POMODORO_SETTINGS;
  }
}

function beep(volume: number) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    // 3 tiếng "bíp" ngắn
    [0, 0.45, 0.9].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.15 * volume;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.25);
    });
    window.setTimeout(() => void ctx.close(), 1600);
  } catch {
    /* âm thanh là tùy chọn */
  }
}

/** Chuông báo hết giờ: tiếng chuông thật (public/sounds/bells.mp3), lỗi thì dùng tiếng bíp */
function ring(bell: BellSound, volume: number) {
  if (bell === 'none') return;
  if (bell === 'beep') return beep(volume);
  const audio = new Audio(`${import.meta.env.BASE_URL}sounds/bells.mp3`);
  audio.volume = volume;
  audio.play().catch(() => beep(volume));
}

function notifyOs(title: string, body: string) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body, icon: '/icon-192.png' });
  } catch {
    /* một số trình duyệt chặn Notification */
  }
}

export function PomodoroProvider({ children }: { children: ReactNode }) {
  const { data, actions } = useAppState();
  const toast = useToast();

  const [settings, setSettings] = useState<PomodoroSettings>(loadSettings);
  const [phase, setPhase] = useState<PomodoroPhase>('focus');
  const [status, setStatus] = useState<PomodoroStatus>('idle');
  const [remainingSeconds, setRemaining] = useState(settings.minutes.focus * 60);
  const [completedFocus, setCompletedFocus] = useState(0);
  const [taskId, setTaskId] = useState('');
  const endAtRef = useRef<number | null>(null);

  const totalSeconds = settings.minutes[phase] * 60;

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* bỏ qua */
    }
  }, [settings]);

  const activeTask = useMemo(() => data.tasks.find((t) => t.id === taskId && t.status !== 'completed'), [data.tasks, taskId]);

  const start = useCallback(() => {
    endAtRef.current = Date.now() + remainingSeconds * 1000;
    setStatus('running');
  }, [remainingSeconds]);

  const pause = useCallback(() => {
    if (endAtRef.current !== null) setRemaining(Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000)));
    endAtRef.current = null;
    setStatus('paused');
  }, []);

  const reset = useCallback(() => {
    endAtRef.current = null;
    setStatus('idle');
    setRemaining(settings.minutes[phase] * 60);
  }, [phase, settings.minutes]);

  const selectPhase = useCallback(
    (next: PomodoroPhase) => {
      endAtRef.current = null;
      setStatus('idle');
      setPhase(next);
      setRemaining(settings.minutes[next] * 60);
    },
    [settings.minutes],
  );

  /** Chuyển sang pha tiếp theo; `autoStart` quyết định có chạy luôn không */
  const goNext = useCallback(
    (from: PomodoroPhase, autoStart: boolean) => {
      const next = getNextPhase(from, completedFocus, settings.longEvery);
      const seconds = settings.minutes[next.phase] * 60;
      setPhase(next.phase);
      setCompletedFocus(next.completedFocus);
      setRemaining(seconds);
      if (autoStart) {
        endAtRef.current = Date.now() + seconds * 1000;
        setStatus('running');
      } else {
        endAtRef.current = null;
        setStatus('idle');
      }
    },
    [completedFocus, settings.longEvery, settings.minutes],
  );

  const skip = useCallback(() => goNext(phase, false), [goNext, phase]);

  const updateSettings = useCallback(
    (patch: Partial<PomodoroSettings>) => {
      setSettings((prev) => {
        const merged = sanitizePomodoroSettings({ ...prev, ...patch, minutes: { ...prev.minutes, ...patch.minutes } });
        // Đồng hồ chưa chạy => cập nhật luôn thời gian hiển thị theo thời lượng mới
        if (status === 'idle') setRemaining(merged.minutes[phase] * 60);
        return merged;
      });
    },
    [status, phase],
  );

  // Vòng lặp đếm ngược khi đang chạy
  useEffect(() => {
    if (status !== 'running') return;
    const id = window.setInterval(() => {
      if (endAtRef.current === null) return;
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left > 0) return;

      // Hết giờ: ghi nhận phiên tập trung, rung chuông rồi chuyển pha
      endAtRef.current = null;
      const minutes = settings.minutes.focus;
      if (phase === 'focus') {
        if (activeTask) {
          actions.logStudy(activeTask.id, minutes, 'pomodoro');
          toast(`Đã ghi nhận ${minutes} phút học cho "${activeTask.title}".`);
        } else {
          toast('Hết phiên tập trung! Chưa chọn nhiệm vụ nên chưa ghi nhận giờ học.', 'info');
        }
        notifyOs('Hết phiên tập trung 🎉', 'Đứng dậy vươn vai và nghỉ một chút nhé.');
      } else {
        toast('Hết giờ nghỉ – sẵn sàng cho phiên tiếp theo!', 'info');
        notifyOs('Hết giờ nghỉ', 'Quay lại học thôi nào!');
      }
      ring(settings.bell, settings.bellVolume);
      goNext(phase, settings.autoStart);
    }, 250);
    return () => window.clearInterval(id);
  }, [status, phase, activeTask, actions, toast, settings, goNext]);

  // Hiển thị thời gian còn lại trên tiêu đề tab
  useEffect(() => {
    document.title = status === 'idle' ? 'SmartStudy AI' : `${formatClock(remainingSeconds)} · ${PHASE_LABEL[phase]} – SmartStudy AI`;
  }, [status, remainingSeconds, phase]);

  const testBell = useCallback((bell?: BellSound) => ring(bell ?? settings.bell, settings.bellVolume), [settings.bell, settings.bellVolume]);

  const value = useMemo<PomodoroValue>(
    () => ({
      phase,
      status,
      remainingSeconds,
      totalSeconds,
      completedFocus,
      settings,
      taskId,
      activeTask,
      setTaskId,
      start,
      pause,
      resume: start,
      reset,
      skip,
      selectPhase,
      updateSettings,
      testBell,
    }),
    [phase, status, remainingSeconds, totalSeconds, completedFocus, settings, taskId, activeTask, start, pause, reset, skip, selectPhase, updateSettings, testBell],
  );

  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>;
}

export function usePomodoro(): PomodoroValue {
  const ctx = useContext(PomodoroContext);
  if (!ctx) throw new Error('usePomodoro phải được dùng bên trong <PomodoroProvider>');
  return ctx;
}
