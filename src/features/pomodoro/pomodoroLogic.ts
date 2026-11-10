/** Logic thuần của Pomodoro: thời lượng từng pha, cài đặt người dùng và quy tắc chuyển pha. */

export type PomodoroPhase = 'focus' | 'short' | 'long';

/** Thời lượng mặc định (phút) theo kỹ thuật Pomodoro gốc */
export const PHASE_MINUTES: Record<PomodoroPhase, number> = { focus: 25, short: 5, long: 15 };
export const PHASE_LABEL: Record<PomodoroPhase, string> = {
  focus: 'Tập trung',
  short: 'Nghỉ ngắn',
  long: 'Nghỉ dài',
};
/** Mặc định: sau 4 phiên tập trung thì nghỉ dài */
export const FOCUS_BEFORE_LONG_BREAK = 4;

export type BellSound = 'bells' | 'beep' | 'none';

/** Cài đặt người dùng tự chỉnh trên trang Focus */
export interface PomodoroSettings {
  minutes: Record<PomodoroPhase, number>;
  /** Số phiên tập trung trước một lần nghỉ dài */
  longEvery: number;
  /** Tự bắt đầu pha tiếp theo khi hết giờ */
  autoStart: boolean;
  bell: BellSound;
  /** 0..1 */
  bellVolume: number;
  /** Hiện thông báo của hệ điều hành khi hết giờ */
  notify: boolean;
}

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  minutes: { ...PHASE_MINUTES },
  longEvery: FOCUS_BEFORE_LONG_BREAK,
  autoStart: false,
  bell: 'bells',
  bellVolume: 0.7,
  notify: false,
};

const clamp = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;

/** Đọc cài đặt đã lưu một cách an toàn (giá trị sai => dùng mặc định). */
export function sanitizePomodoroSettings(raw: unknown): PomodoroSettings {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const m = (typeof r.minutes === 'object' && r.minutes !== null ? r.minutes : {}) as Record<string, unknown>;
  const d = DEFAULT_POMODORO_SETTINGS;
  return {
    minutes: {
      focus: clamp(m.focus, 1, 180, d.minutes.focus),
      short: clamp(m.short, 1, 60, d.minutes.short),
      long: clamp(m.long, 1, 90, d.minutes.long),
    },
    longEvery: clamp(r.longEvery, 2, 10, d.longEvery),
    autoStart: r.autoStart === true,
    bell: r.bell === 'beep' || r.bell === 'none' || r.bell === 'bells' ? r.bell : d.bell,
    bellVolume: typeof r.bellVolume === 'number' && r.bellVolume >= 0 && r.bellVolume <= 1 ? r.bellVolume : d.bellVolume,
    notify: r.notify === true,
  };
}

export interface PhaseTransition {
  phase: PomodoroPhase;
  /** Số phiên tập trung đã hoàn thành trong chu kỳ hiện tại */
  completedFocus: number;
}

/** Pha kế tiếp khi `current` kết thúc. */
export function getNextPhase(current: PomodoroPhase, completedFocus: number, longEvery = FOCUS_BEFORE_LONG_BREAK): PhaseTransition {
  if (current === 'focus') {
    const done = completedFocus + 1;
    return { phase: done % longEvery === 0 ? 'long' : 'short', completedFocus: done };
  }
  // Hết nghỉ dài => bắt đầu chu kỳ mới; hết nghỉ ngắn => giữ nguyên bộ đếm
  return { phase: 'focus', completedFocus: current === 'long' ? 0 : completedFocus };
}

/** 1500 -> "25:00"; từ 1 giờ trở lên -> "1:05:00" */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
