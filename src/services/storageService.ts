/**
 * Lưu/đọc dữ liệu ứng dụng bằng LocalStorage.
 *
 * - Toàn bộ AppData nằm trong MỘT key có phiên bản (dễ migrate sau này).
 * - Khi đọc: parse an toàn + kiểm tra từng phần tử; phần tử hỏng bị loại bỏ thay vì làm sập app.
 * - Chưa có dữ liệu (lần đầu mở app) => nạp dữ liệu mẫu.
 * - Dữ liệu hỏng hoàn toàn => sao lưu bản hỏng sang key khác rồi nạp lại dữ liệu mẫu.
 * - Nhận `store` làm tham số nên test được mà không cần trình duyệt.
 */
import { DEFAULT_AVAILABILITY, DEFAULT_USER_NAME, SESSION_MINUTES_MAX, SESSION_MINUTES_MIN } from '../constants';
import type {
  AppData,
  Availability,
  CalendarEvent,
  SessionLength,
  StudySchedule,
  StudySession,
  Subject,
  Task,
  TimeSlot,
} from '../types';
import { createSeedData } from './seedData';

export const STORAGE_KEY = 'smartstudy.v1.data';
export const CORRUPT_BACKUP_KEY = 'smartstudy.v1.data.corrupt';
const DATA_VERSION = 1;

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** 'storage': đọc được dữ liệu cũ · 'seed': lần đầu, nạp dữ liệu mẫu · 'recovered': dữ liệu hỏng, đã khôi phục */
export type LoadSource = 'storage' | 'seed' | 'recovered';

export interface LoadResult {
  data: AppData;
  source: LoadSource;
  /** Số phần tử hỏng đã bị loại bỏ khi đọc */
  droppedItems: number;
}

/** LocalStorage có thể không tồn tại / bị chặn (chế độ riêng tư) => trả về null. */
export function getBrowserStore(): KeyValueStore | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const probe = '__smartstudy_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

// ---------- Kiểm tra kiểu từng phần tử ----------
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isIso = (v: unknown): v is string => isStr(v) && !Number.isNaN(new Date(v).getTime());
const oneOf = <T extends string>(v: unknown, list: readonly T[]): v is T => isStr(v) && (list as readonly string[]).includes(v);
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
const IMPORTANCES = ['low', 'medium', 'high'] as const;
const STATUSES = ['todo', 'in_progress', 'completed'] as const;
const ORIGINS = ['scheduler', 'pomodoro', 'manual'] as const;

export function sanitizeSubject(raw: unknown): Subject | null {
  if (!isObj(raw)) return null;
  if (!isStr(raw.id) || !isStr(raw.name) || !isStr(raw.code)) return null;
  if (!isStr(raw.color) || !/^#[0-9a-fA-F]{6}$/.test(raw.color)) return null;
  if (!oneOf(raw.difficulty, DIFFICULTIES)) return null;
  return {
    id: raw.id,
    name: raw.name,
    code: raw.code,
    color: raw.color,
    difficulty: raw.difficulty,
    description: isStr(raw.description) ? raw.description : '',
  };
}

export function sanitizeTask(raw: unknown): Task | null {
  if (!isObj(raw)) return null;
  if (!isStr(raw.id) || !isStr(raw.title) || !isStr(raw.subjectId)) return null;
  if (!isIso(raw.deadline) || !isIso(raw.createdAt)) return null;
  if (!isNum(raw.estimatedMinutes) || raw.estimatedMinutes <= 0) return null;
  if (!oneOf(raw.difficulty, DIFFICULTIES) || !oneOf(raw.importance, IMPORTANCES) || !oneOf(raw.status, STATUSES))
    return null;
  return {
    id: raw.id,
    title: raw.title,
    subjectId: raw.subjectId,
    description: isStr(raw.description) ? raw.description : '',
    deadline: raw.deadline,
    estimatedMinutes: raw.estimatedMinutes,
    actualMinutes: isNum(raw.actualMinutes) && raw.actualMinutes >= 0 ? raw.actualMinutes : 0,
    difficulty: raw.difficulty,
    importance: raw.importance,
    status: raw.status,
    createdAt: raw.createdAt,
    completedAt: isIso(raw.completedAt) ? raw.completedAt : null,
  };
}

export function sanitizeSession(raw: unknown): StudySession | null {
  if (!isObj(raw)) return null;
  if (!isStr(raw.id) || !isStr(raw.taskId) || !isStr(raw.subjectId)) return null;
  if (!isStr(raw.date) || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) return null;
  if (!isNum(raw.minutes) || raw.minutes <= 0) return null;
  if (typeof raw.completed !== 'boolean' || !oneOf(raw.origin, ORIGINS)) return null;
  return {
    id: raw.id,
    taskId: raw.taskId,
    subjectId: raw.subjectId,
    date: raw.date,
    startTime: isStr(raw.startTime) && HHMM.test(raw.startTime) ? raw.startTime : null,
    endTime: isStr(raw.endTime) && HHMM.test(raw.endTime) ? raw.endTime : null,
    minutes: raw.minutes,
    completed: raw.completed,
    origin: raw.origin,
    ...(raw.pinned === true ? { pinned: true } : {}),
  };
}

function sanitizeAvailability(raw: unknown): Availability {
  if (!isObj(raw)) return cloneDefaultAvailability();
  const days = Array.isArray(raw.days)
    ? [...new Set(raw.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : DEFAULT_AVAILABILITY.days;
  const slots: TimeSlot[] = Array.isArray(raw.slots)
    ? raw.slots.filter(
        (s): s is TimeSlot => isObj(s) && isStr(s.start) && isStr(s.end) && HHMM.test(s.start) && HHMM.test(s.end) && s.start < s.end,
      ).map((s) => ({ start: s.start, end: s.end }))
    : DEFAULT_AVAILABILITY.slots;
  const sessionMinutes: SessionLength =
    isNum(raw.sessionMinutes) && Number.isInteger(raw.sessionMinutes) && raw.sessionMinutes >= SESSION_MINUTES_MIN && raw.sessionMinutes <= SESSION_MINUTES_MAX
      ? raw.sessionMinutes
      : DEFAULT_AVAILABILITY.sessionMinutes;
  const breakMinutes = isNum(raw.breakMinutes) && raw.breakMinutes >= 0 && raw.breakMinutes <= 60 ? raw.breakMinutes : DEFAULT_AVAILABILITY.breakMinutes;
  // Khung giờ riêng theo từng thứ
  const daySlots: Record<string, TimeSlot[]> = {};
  if (isObj(raw.daySlots)) {
    for (const [k, v] of Object.entries(raw.daySlots)) {
      if (!/^[0-6]$/.test(k) || !Array.isArray(v)) continue;
      daySlots[k] = v
        .filter((s): s is TimeSlot => isObj(s) && isStr(s.start) && isStr(s.end) && HHMM.test(s.start) && HHMM.test(s.end) && s.start < s.end)
        .map((s) => ({ start: s.start, end: s.end }));
    }
  }
  // Ngày đặc biệt ('YYYY-MM-DD' -> khung giờ; mảng rỗng = nghỉ cả ngày)
  const dateOverrides: Record<string, TimeSlot[]> = {};
  if (isObj(raw.dateOverrides)) {
    for (const [k, v] of Object.entries(raw.dateOverrides)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !Array.isArray(v)) continue;
      dateOverrides[k] = v
        .filter((s): s is TimeSlot => isObj(s) && isStr(s.start) && isStr(s.end) && HHMM.test(s.start) && HHMM.test(s.end) && s.start < s.end)
        .map((s) => ({ start: s.start, end: s.end }));
    }
  }
  return { days, slots, sessionMinutes, breakMinutes, perDay: raw.perDay === true, daySlots, dateOverrides, autoReschedule: raw.autoReschedule !== false };
}

function cloneDefaultAvailability(): Availability {
  return { ...DEFAULT_AVAILABILITY, days: [...DEFAULT_AVAILABILITY.days], slots: DEFAULT_AVAILABILITY.slots.map((s) => ({ ...s })), daySlots: {}, dateOverrides: {} };
}

function sanitizeSchedule(raw: unknown): StudySchedule | null {
  if (!isObj(raw) || !isIso(raw.generatedAt) || !Array.isArray(raw.sessions)) return null;
  const sessions = raw.sessions.map(sanitizeSession).filter((s): s is StudySession => s !== null);
  const unscheduled = Array.isArray(raw.unscheduled)
    ? raw.unscheduled.filter(
        (u): u is StudySchedule['unscheduled'][number] => isObj(u) && isStr(u.taskId) && isNum(u.missingMinutes) && isStr(u.reason),
      )
    : [];
  const warnings = Array.isArray(raw.warnings) ? raw.warnings.filter(isStr) : [];
  const st = isObj(raw.stats) ? raw.stats : {};
  const num = (v: unknown) => (isNum(v) && v >= 0 ? v : 0);
  return {
    generatedAt: raw.generatedAt,
    sessions,
    unscheduled,
    warnings,
    stats: {
      requiredMinutes: num(st.requiredMinutes),
      scheduledMinutes: num(st.scheduledMinutes),
      capacityMinutes: num(st.capacityMinutes),
      horizonDays: num(st.horizonDays),
    },
    inputSignature: isStr(raw.inputSignature) ? raw.inputSignature : '',
  };
}

const REPEATS = ['none', 'daily', 'weekly'] as const;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function sanitizeEvent(raw: unknown): CalendarEvent | null {
  if (!isObj(raw) || !isStr(raw.id) || !isStr(raw.title) || !raw.title.trim()) return null;
  if (!isStr(raw.date) || !DATE_KEY.test(raw.date)) return null;
  const allDay = raw.allDay === true;
  const startTime = isStr(raw.startTime) && HHMM.test(raw.startTime) ? raw.startTime : null;
  const endTime = isStr(raw.endTime) && HHMM.test(raw.endTime) ? raw.endTime : null;
  if (!allDay && (!startTime || !endTime || endTime <= startTime)) return null;
  return {
    id: raw.id,
    title: raw.title,
    date: raw.date,
    startTime: startTime ?? '00:00',
    endTime: endTime ?? '23:59',
    allDay,
    color: isStr(raw.color) && /^#[0-9a-fA-F]{6}$/.test(raw.color) ? raw.color : '#5B8C5A',
    location: isStr(raw.location) ? raw.location : '',
    description: isStr(raw.description) ? raw.description : '',
    repeat: oneOf(raw.repeat, REPEATS) ? raw.repeat : 'none',
    repeatUntil: isStr(raw.repeatUntil) && DATE_KEY.test(raw.repeatUntil) ? raw.repeatUntil : null,
    blocksStudy: raw.blocksStudy !== false,
  };
}

/** Bỏ các phiên/ghi chú của lịch thuộc task không còn tồn tại. */
function pruneScheduleToTasks(schedule: StudySchedule | null, taskIds: Set<string>): StudySchedule | null {
  if (!schedule) return null;
  return {
    ...schedule,
    sessions: schedule.sessions.filter((s) => taskIds.has(s.taskId)),
    unscheduled: schedule.unscheduled.filter((u) => taskIds.has(u.taskId)),
  };
}

/** Kiểm tra + làm sạch dữ liệu thô. Trả về null nếu cấu trúc gốc sai hoàn toàn. */
export function sanitizeAppData(raw: unknown): { data: AppData; dropped: number } | null {
  if (!isObj(raw) || raw.version !== DATA_VERSION) return null;
  if (!Array.isArray(raw.subjects) || !Array.isArray(raw.tasks)) return null;

  let dropped = 0;
  const keep = <T,>(list: unknown[], fn: (x: unknown) => T | null): T[] =>
    list.reduce<T[]>((acc, item) => {
      const ok = fn(item);
      if (ok) acc.push(ok);
      else dropped++;
      return acc;
    }, []);

  const subjects = keep(raw.subjects, sanitizeSubject);
  const subjectIds = new Set(subjects.map((s) => s.id));
  // Task mồ côi (môn học không còn) bị loại để tránh lỗi hiển thị
  const tasks = keep(raw.tasks, (x) => {
    const t = sanitizeTask(x);
    return t && subjectIds.has(t.subjectId) ? t : null;
  });
  const taskIds = new Set(tasks.map((t) => t.id));
  const sessions = keep(Array.isArray(raw.sessions) ? raw.sessions : [], (x) => {
    const s = sanitizeSession(x);
    return s && taskIds.has(s.taskId) ? s : null;
  });

  return {
    dropped,
    data: {
      subjects,
      tasks,
      sessions,
      availability: sanitizeAvailability(raw.availability),
      schedule: pruneScheduleToTasks(sanitizeSchedule(raw.schedule), taskIds),
      // Dữ liệu cũ (trước khi có Lịch) chưa có `events` => mảng rỗng, không tính là hỏng
      events: Array.isArray(raw.events) ? keep(raw.events, sanitizeEvent) : [],
      userName: isStr(raw.userName) && raw.userName.trim() ? raw.userName.trim().slice(0, 30) : DEFAULT_USER_NAME,
    },
  };
}

/** Đọc dữ liệu: có -> dùng; chưa có -> dữ liệu mẫu; hỏng -> sao lưu + dữ liệu mẫu. */
export function loadAppData(now: Date = new Date(), store: KeyValueStore | null = getBrowserStore()): LoadResult {
  if (!store) return { data: createSeedData(now), source: 'seed', droppedItems: 0 };

  let text: string | null = null;
  try {
    text = store.getItem(STORAGE_KEY);
  } catch {
    return { data: createSeedData(now), source: 'seed', droppedItems: 0 };
  }
  if (text === null) return { data: createSeedData(now), source: 'seed', droppedItems: 0 };

  try {
    const result = sanitizeAppData(JSON.parse(text));
    if (result) return { data: result.data, source: 'storage', droppedItems: result.dropped };
  } catch {
    /* JSON hỏng – rơi xuống nhánh khôi phục */
  }

  try {
    store.setItem(CORRUPT_BACKUP_KEY, text);
  } catch {
    /* bỏ qua lỗi sao lưu */
  }
  return { data: createSeedData(now), source: 'recovered', droppedItems: 0 };
}

/** Ghi dữ liệu. Trả về false nếu thất bại (đầy bộ nhớ, bị chặn…). */
export function saveAppData(data: AppData, store: KeyValueStore | null = getBrowserStore()): boolean {
  if (!store) return false;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, ...data }));
    return true;
  } catch {
    return false;
  }
}

/** Nút "Reset Demo Data": ghi đè bằng dữ liệu mẫu mới. */
export function resetToDemoData(now: Date = new Date(), store: KeyValueStore | null = getBrowserStore()): AppData {
  const data = createSeedData(now);
  saveAppData(data, store);
  return data;
}
