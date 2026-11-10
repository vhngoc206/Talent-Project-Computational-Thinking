import { describe, expect, it } from 'vitest';
import { generateSchedule } from '../algorithms/greedyScheduler';
import { computeWeeklyPerformance, computeSubjectProgress } from '../features/analytics/stats';
import { createSeedData } from '../services/seedData';
import { loadAppData, saveAppData, type KeyValueStore } from '../services/storageService';
import { validateAvailability } from '../utils/validation';
import { appReducer } from './appReducer';

const NOW = new Date(2026, 10, 4, 8, 0);

function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
}

function withSchedule() {
  const data = createSeedData(NOW);
  const schedule = generateSchedule(data.tasks, data.availability, { now: NOW });
  return appReducer(data, { type: 'schedule/set', schedule });
}

describe('Lịch học trong state', () => {
  it('đánh dấu phiên đã học => cộng giờ vào task + tạo phiên ghi nhận; bỏ đánh dấu => hoàn tác', () => {
    const state = withSchedule();
    const planned = state.schedule!.sessions[0];
    const before = state.tasks.find((t) => t.id === planned.taskId)!.actualMinutes;

    const done = appReducer(state, { type: 'schedule/toggleSession', sessionId: planned.id, completed: true, today: '2026-11-04' });
    expect(done.tasks.find((t) => t.id === planned.taskId)!.actualMinutes).toBe(before + planned.minutes);
    expect(done.sessions.some((s) => s.id === planned.id && s.completed)).toBe(true);
    expect(done.schedule!.sessions[0].completed).toBe(true);

    const undone = appReducer(done, { type: 'schedule/toggleSession', sessionId: planned.id, completed: false, today: '2026-11-04' });
    expect(undone.tasks.find((t) => t.id === planned.taskId)!.actualMinutes).toBe(before);
    expect(undone.sessions.some((s) => s.id === planned.id)).toBe(false);
  });

  it('xóa task => phiên trong lịch của task đó cũng bị xóa', () => {
    const state = withSchedule();
    const taskId = state.schedule!.sessions[0].taskId;
    const next = appReducer(state, { type: 'task/delete', id: taskId });
    expect(next.schedule!.sessions.some((s) => s.taskId === taskId)).toBe(false);
  });

  it('lịch học được lưu và đọc lại sau khi refresh (LocalStorage)', () => {
    const store = memoryStore();
    const state = withSchedule();
    expect(saveAppData(state, store)).toBe(true);
    const loaded = loadAppData(NOW, store);
    expect(loaded.source).toBe('storage');
    expect(loaded.data.schedule!.sessions).toHaveLength(state.schedule!.sessions.length);
    expect(loaded.data.schedule!.stats).toEqual(state.schedule!.stats);
    expect(loaded.data.schedule!.inputSignature).toBe(state.schedule!.inputSignature);
  });
});

describe('validateAvailability', () => {
  const ok = { days: [1, 2], slots: [{ start: '19:00', end: '21:00' }], sessionMinutes: 45 as const, breakMinutes: 10 };
  it('hợp lệ', () => expect(validateAvailability(ok)).toEqual([]));
  it('báo lỗi thiếu ngày, giờ ngược, khung chồng nhau', () => {
    expect(validateAvailability({ ...ok, days: [] })[0]).toMatch(/ít nhất một ngày/);
    expect(validateAvailability({ ...ok, slots: [{ start: '21:00', end: '19:00' }] }).join()).toMatch(/kết thúc phải sau/);
    expect(
      validateAvailability({ ...ok, slots: [{ start: '19:00', end: '21:00' }, { start: '20:00', end: '22:00' }] }).join(),
    ).toMatch(/chồng lên nhau/);
  });
});

describe('Thống kê theo tuần / theo môn', () => {
  it('giờ học theo tuần khớp với tổng các phiên đã học', () => {
    const data = createSeedData(NOW);
    const weeks = computeWeeklyPerformance(data.tasks, data.sessions, NOW, 6);
    expect(weeks).toHaveLength(6);
    expect(weeks[5].isCurrent).toBe(true);
    const total = data.sessions.reduce((s, x) => s + x.minutes, 0);
    expect(weeks.reduce((s, w) => s + w.minutes, 0)).toBe(total); // dữ liệu mẫu nằm trong 7 ngày qua
    expect(weeks.reduce((s, w) => s + w.completedTasks, 0)).toBe(data.tasks.filter((t) => t.status === 'completed').length);
  });

  it('tiến độ theo môn cộng đúng số task', () => {
    const data = createSeedData(NOW);
    const p = computeSubjectProgress(data.tasks, data.subjects);
    expect(p.reduce((s, x) => s + x.totalTasks, 0)).toBe(data.tasks.length);
  });
});
