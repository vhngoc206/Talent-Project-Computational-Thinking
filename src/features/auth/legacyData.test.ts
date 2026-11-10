import { describe, expect, it } from 'vitest';
import { saveAppData } from '../../services/storageService';
import { createEmptyData, createSeedData } from '../../services/seedData';
import { countNewItems, legacyHandled, markLegacyHandled, mergeLegacy, readLegacyData } from './legacyData';

function memoryStore() {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) };
}

const NOW = new Date(2026, 10, 4, 8, 0, 0);

describe('Chuyển dữ liệu cũ vào tài khoản', () => {
  it('đọc được dữ liệu cũ trong LocalStorage; trống thì trả về null', () => {
    const store = memoryStore();
    expect(readLegacyData(store)).toBeNull();
    saveAppData(createEmptyData(), store);
    expect(readLegacyData(store)).toBeNull();
    saveAppData(createSeedData(NOW), store);
    expect(readLegacyData(store)?.tasks.length).toBeGreaterThan(0);
  });

  it('tài khoản trống: nhận toàn bộ dữ liệu cũ, giữ tên tài khoản', () => {
    const legacy = createSeedData(NOW);
    const merged = mergeLegacy(createEmptyData('Ngọc'), legacy);
    expect(merged.tasks).toHaveLength(legacy.tasks.length);
    expect(merged.subjects).toHaveLength(legacy.subjects.length);
    expect(merged.events).toHaveLength(legacy.events.length);
    expect(merged.userName).toBe('Ngọc');
  });

  it('gộp không trùng: mục đã có trong tài khoản không bị thêm lần nữa', () => {
    const legacy = createSeedData(NOW);
    const current = { ...createEmptyData(), subjects: legacy.subjects.slice(0, 2), tasks: legacy.tasks.slice(0, 3) };
    const counts = countNewItems(current, legacy);
    expect(counts.tasks).toBe(legacy.tasks.length - 3);
    const merged = mergeLegacy(current, legacy);
    expect(new Set(merged.tasks.map((t) => t.id)).size).toBe(merged.tasks.length);
    expect(countNewItems(merged, legacy)).toEqual({ subjects: 0, tasks: 0, events: 0 });
  });

  it('đánh dấu đã xử lý theo từng tài khoản', () => {
    const store = memoryStore();
    expect(legacyHandled('u1', store)).toBe(false);
    markLegacyHandled('u1', store);
    expect(legacyHandled('u1', store)).toBe(true);
    expect(legacyHandled('u2', store)).toBe(false);
  });
});
