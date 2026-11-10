import { beforeEach, describe, expect, it } from 'vitest';
import { appReducer } from '../state/appReducer';
import { createSeedData } from './seedData';
import {
  CORRUPT_BACKUP_KEY,
  loadAppData,
  resetToDemoData,
  saveAppData,
  STORAGE_KEY,
  type KeyValueStore,
} from './storageService';

const NOW = new Date('2026-11-04T08:00:00.000Z');

/** LocalStorage giả lập trong bộ nhớ */
function createMemoryStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe('storageService', () => {
  let store: ReturnType<typeof createMemoryStore>;
  beforeEach(() => {
    store = createMemoryStore();
  });

  it('LocalStorage chưa có dữ liệu => nạp dữ liệu mẫu', () => {
    const result = loadAppData(NOW, store);
    expect(result.source).toBe('seed');
    expect(result.data.subjects).toHaveLength(5);
    expect(result.data.tasks.length).toBeGreaterThan(0);
  });

  it('không có LocalStorage (bị chặn) => vẫn chạy với dữ liệu mẫu, lưu trả về false', () => {
    expect(loadAppData(NOW, null).source).toBe('seed');
    expect(saveAppData(createSeedData(NOW), null)).toBe(false);
  });

  it('dữ liệu còn nguyên sau khi "refresh" (lưu rồi đọc lại)', () => {
    const seeded = createSeedData(NOW);
    const edited = appReducer(seeded, {
      type: 'task/setStatus',
      id: seeded.tasks[0].id,
      status: 'completed',
      now: NOW.toISOString(),
    });
    expect(saveAppData(edited, store)).toBe(true);

    const reloaded = loadAppData(NOW, store);
    expect(reloaded.source).toBe('storage');
    expect(reloaded.data).toEqual(edited);
    expect(reloaded.data.tasks[0].status).toBe('completed');
  });

  it('JSON hỏng => sao lưu bản hỏng và khôi phục dữ liệu mẫu', () => {
    store.setItem(STORAGE_KEY, '{không phải json');
    const result = loadAppData(NOW, store);
    expect(result.source).toBe('recovered');
    expect(store.getItem(CORRUPT_BACKUP_KEY)).toBe('{không phải json');
  });

  it('sai phiên bản / cấu trúc => khôi phục dữ liệu mẫu', () => {
    store.setItem(STORAGE_KEY, JSON.stringify({ version: 99, subjects: [], tasks: [] }));
    expect(loadAppData(NOW, store).source).toBe('recovered');
  });

  it('loại bỏ phần tử hỏng và task mồ côi nhưng giữ phần còn lại', () => {
    const seeded = createSeedData(NOW);
    const raw = {
      version: 1,
      ...seeded,
      tasks: [
        ...seeded.tasks,
        { id: 'bad', title: 123 }, // sai kiểu
        { ...seeded.tasks[0], id: 'orphan', subjectId: 'khong-ton-tai' }, // môn học không tồn tại
      ],
    };
    store.setItem(STORAGE_KEY, JSON.stringify(raw));
    const result = loadAppData(NOW, store);
    expect(result.source).toBe('storage');
    expect(result.droppedItems).toBe(2);
    expect(result.data.tasks).toHaveLength(seeded.tasks.length);
  });

  it('resetToDemoData ghi đè bằng dữ liệu mẫu mới', () => {
    const seeded = createSeedData(NOW);
    saveAppData({ ...seeded, tasks: [], subjects: [] }, store);
    const reset = resetToDemoData(NOW, store);
    expect(reset.tasks.length).toBe(seeded.tasks.length);
    expect(loadAppData(NOW, store).data.tasks.length).toBe(seeded.tasks.length);
  });
});
