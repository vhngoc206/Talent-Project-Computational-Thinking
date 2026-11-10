/**
 * Dữ liệu nhập TRƯỚC khi có đăng nhập vẫn nằm trong LocalStorage của trình duyệt cũ.
 * Các hàm thuần dưới đây đọc dữ liệu đó và GỘP vào dữ liệu tài khoản (không ghi đè, không trùng id).
 */
import { getBrowserStore, sanitizeAppData, STORAGE_KEY, type KeyValueStore } from '../../services/storageService';
import type { AppData } from '../../types';

const handledKey = (uid: string) => `smartstudy.v1.legacyHandled.${uid}`;

/** Dữ liệu cũ trên trình duyệt này (null nếu không có hoặc trống) */
export function readLegacyData(store: KeyValueStore | null = getBrowserStore()): AppData | null {
  try {
    const raw = store?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = sanitizeAppData(JSON.parse(raw))?.data ?? null;
    if (!data || (data.subjects.length === 0 && data.tasks.length === 0 && data.events.length === 0)) return null;
    return data;
  } catch {
    return null;
  }
}

export function legacyHandled(uid: string, store: KeyValueStore | null = getBrowserStore()): boolean {
  try {
    return store?.getItem(handledKey(uid)) === '1';
  } catch {
    return true;
  }
}

export function markLegacyHandled(uid: string, store: KeyValueStore | null = getBrowserStore()): void {
  try {
    store?.setItem(handledKey(uid), '1');
  } catch {
    /* bỏ qua */
  }
}

/** Những mục của `legacy` chưa có trong `current` (so theo id) */
export function countNewItems(current: AppData, legacy: AppData) {
  const has = <T extends { id: string }>(list: T[]) => new Set(list.map((x) => x.id));
  const s = has(current.subjects);
  const t = has(current.tasks);
  const e = has(current.events);
  return {
    subjects: legacy.subjects.filter((x) => !s.has(x.id)).length,
    tasks: legacy.tasks.filter((x) => !t.has(x.id)).length,
    events: legacy.events.filter((x) => !e.has(x.id)).length,
  };
}

/** Gộp dữ liệu cũ vào dữ liệu tài khoản: giữ mọi thứ đang có, thêm những mục chưa có. */
export function mergeLegacy(current: AppData, legacy: AppData): AppData {
  const addMissing = <T extends { id: string }>(a: T[], b: T[]) => {
    const ids = new Set(a.map((x) => x.id));
    return [...a, ...b.filter((x) => !ids.has(x.id))];
  };
  const accountEmpty = current.subjects.length === 0 && current.tasks.length === 0;
  return {
    ...current,
    subjects: addMissing(current.subjects, legacy.subjects),
    tasks: addMissing(current.tasks, legacy.tasks),
    sessions: addMissing(current.sessions, legacy.sessions),
    events: addMissing(current.events, legacy.events),
    // Tài khoản còn trống thì lấy luôn thời gian rảnh & lịch học cũ
    availability: accountEmpty ? legacy.availability : current.availability,
    schedule: current.schedule ?? legacy.schedule,
  };
}
