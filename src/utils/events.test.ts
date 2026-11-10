import { describe, expect, it } from 'vitest';
import { generateSchedule } from '../algorithms/greedyScheduler';
import { sanitizeAppData } from '../services/storageService';
import type { Availability, CalendarEvent, Task } from '../types';
import { busyIntervals, dateAt, expandEvents, layoutOverlaps, occursOn, validateEvent } from './events';

// Thứ tư 04/11/2026
const NOW = new Date(2026, 10, 4, 8, 0, 0);

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'e1',
    title: 'Sự kiện',
    date: '2026-11-04',
    startTime: '19:00',
    endTime: '20:00',
    allDay: false,
    color: '#5B8C5A',
    location: '',
    description: '',
    repeat: 'none',
    repeatUntil: null,
    blocksStudy: true,
    ...overrides,
  };
}

describe('Sự kiện lịch – lặp lại', () => {
  it('sự kiện một lần chỉ xảy ra đúng ngày', () => {
    const e = makeEvent();
    expect(occursOn(e, '2026-11-04')).toBe(true);
    expect(occursOn(e, '2026-11-05')).toBe(false);
  });

  it('lặp hằng tuần đúng thứ, dừng sau repeatUntil', () => {
    const e = makeEvent({ repeat: 'weekly', repeatUntil: '2026-11-18' });
    expect(occursOn(e, '2026-11-11')).toBe(true); // thứ tư tuần sau
    expect(occursOn(e, '2026-11-12')).toBe(false);
    expect(occursOn(e, '2026-11-25')).toBe(false); // sau repeatUntil
    expect(occursOn(e, '2026-10-28')).toBe(false); // trước ngày bắt đầu
  });

  it('expandEvents trải sự kiện hằng ngày thành từng lần, có giờ chính xác', () => {
    const occ = expandEvents([makeEvent({ repeat: 'daily' })], NOW, dateAt('2026-11-06'));
    expect(occ.map((o) => o.date)).toEqual(['2026-11-04', '2026-11-05', '2026-11-06']);
    expect(occ[0].startMs).toBe(new Date(2026, 10, 4, 19, 0).getTime());
    expect(occ[0].endMs - occ[0].startMs).toBe(60 * 60_000);
  });

  it('chỉ sự kiện blocksStudy mới tính là giờ bận', () => {
    const busy = busyIntervals([makeEvent(), makeEvent({ id: 'e2', blocksStudy: false })], NOW, NOW);
    expect(busy).toHaveLength(1);
  });
});

describe('Sự kiện lịch – kiểm tra & hiển thị', () => {
  it('báo lỗi tên trống và giờ kết thúc trước giờ bắt đầu', () => {
    const errors = validateEvent({ ...makeEvent({ title: ' ', startTime: '10:00', endTime: '09:00' }) });
    expect(errors.title).toBeTruthy();
    expect(errors.endTime).toBeTruthy();
    expect(validateEvent(makeEvent())).toEqual({});
  });

  it('sự kiện chồng giờ được chia cột cạnh nhau', () => {
    const h = (x: number) => x * 3_600_000;
    const out = layoutOverlaps([
      { id: 'a', startMs: h(9), endMs: h(11) },
      { id: 'b', startMs: h(10), endMs: h(12) },
      { id: 'c', startMs: h(13), endMs: h(14) },
    ]);
    const byId = Object.fromEntries(out.map((o) => [o.id, o]));
    expect(byId.a.col).toBe(0);
    expect(byId.b.col).toBe(1);
    expect(byId.a.cols).toBe(2);
    expect(byId.c).toMatchObject({ col: 0, cols: 1 });
  });

  it('dữ liệu cũ chưa có events vẫn đọc được (events = [])', () => {
    const res = sanitizeAppData({ version: 1, subjects: [], tasks: [] });
    expect(res?.data.events).toEqual([]);
  });
});

describe('Greedy Scheduler tôn trọng sự kiện', () => {
  const availability: Availability = { days: [0, 1, 2, 3, 4, 5, 6], slots: [{ start: '19:00', end: '21:00' }], sessionMinutes: 45, breakMinutes: 10 };
  const task: Task = {
    id: 't1',
    title: 'Task',
    subjectId: 's1',
    description: '',
    deadline: new Date(2026, 10, 4, 23, 59).toISOString(),
    estimatedMinutes: 60,
    actualMinutes: 0,
    difficulty: 'medium',
    importance: 'medium',
    status: 'todo',
    createdAt: NOW.toISOString(),
    completedAt: null,
  };

  it('không xếp phiên học vào giờ có sự kiện bận', () => {
    const busy = busyIntervals([makeEvent({ startTime: '19:00', endTime: '20:00' })], NOW, NOW);
    const s = generateSchedule([task], availability, { now: NOW, busy });
    expect(s.sessions.length).toBeGreaterThan(0);
    for (const ses of s.sessions) expect(ses.startTime! >= '20:00').toBe(true);
    // Chỉ còn 1 tiếng rảnh (20:00–21:00) nên đủ 60 phút
    expect(s.stats.capacityMinutes).toBe(60);
  });

  it('sự kiện chiếm hết giờ rảnh => cảnh báo không đủ thời gian', () => {
    const busy = busyIntervals([makeEvent({ startTime: '18:00', endTime: '22:00' })], NOW, NOW);
    const s = generateSchedule([task], availability, { now: NOW, busy });
    expect(s.sessions).toHaveLength(0);
    expect(s.unscheduled[0].missingMinutes).toBe(60);
  });
});
