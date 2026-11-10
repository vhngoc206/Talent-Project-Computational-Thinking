import { describe, expect, it } from 'vitest';
import type { Availability, StudySession, Task } from '../types';
import {
  buildFreeBlocks,
  computeScheduleSignature,
  defaultHorizonDays,
  generateSchedule,
  subtractInterval,
} from './greedyScheduler';

// Thứ tư 04/11/2026, 08:00 giờ địa phương
const NOW = new Date(2026, 10, 4, 8, 0, 0);
const at = (dayOffset: number, h: number, m = 0) => new Date(2026, 10, 4 + dayOffset, h, m, 0).toISOString();

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Task',
    subjectId: 's1',
    description: '',
    deadline: at(5, 23, 59),
    estimatedMinutes: 120,
    actualMinutes: 0,
    difficulty: 'medium',
    importance: 'medium',
    status: 'todo',
    createdAt: at(-3, 8),
    completedAt: null,
    ...overrides,
  };
}

const EVERYDAY: Availability = { days: [0, 1, 2, 3, 4, 5, 6], slots: [{ start: '19:00', end: '21:00' }], sessionMinutes: 45, breakMinutes: 10 };

/** Mốc thời gian tuyệt đối của một phiên */
function interval(s: StudySession) {
  const [y, mo, d] = s.date.split('-').map(Number);
  const [sh, sm] = s.startTime!.split(':').map(Number);
  const [eh, em] = s.endTime!.split(':').map(Number);
  return { start: new Date(y, mo - 1, d, sh, sm).getTime(), end: new Date(y, mo - 1, d, eh, em).getTime() };
}

describe('buildFreeBlocks', () => {
  it('chỉ tạo khối vào các ngày được chọn', () => {
    // Chỉ thứ bảy (6) – trong 7 ngày từ thứ tư chỉ có 1 thứ bảy
    const blocks = buildFreeBlocks({ ...EVERYDAY, days: [6] }, NOW, 7);
    expect(blocks).toHaveLength(1);
    expect(new Date(blocks[0].startMs).getDay()).toBe(6);
  });

  it('cắt bỏ phần đã trôi qua của hôm nay và gộp khung chồng lấn', () => {
    const now = new Date(2026, 10, 4, 19, 32);
    const blocks = buildFreeBlocks({ ...EVERYDAY, slots: [{ start: '19:00', end: '20:30' }, { start: '20:00', end: '21:00' }] }, now, 1);
    expect(blocks).toHaveLength(1);
    expect(new Date(blocks[0].startMs).getHours()).toBe(19);
    expect(new Date(blocks[0].startMs).getMinutes()).toBe(35); // làm tròn lên bội số 5 phút
    expect(new Date(blocks[0].endMs).getHours()).toBe(21);
  });

  it('subtractInterval tách khối khi có phiên giữ lại ở giữa', () => {
    const out = subtractInterval([{ startMs: 0, endMs: 100 }], 30, 60);
    expect(out).toEqual([
      { startMs: 0, endMs: 30 },
      { startMs: 60, endMs: 100 },
    ]);
  });
});

describe('generateSchedule (Greedy)', () => {
  it('chia nhiệm vụ dài thành nhiều phiên không vượt quá độ dài phiên', () => {
    const s = generateSchedule([makeTask({ estimatedMinutes: 120 })], EVERYDAY, { now: NOW });
    expect(s.sessions.map((x) => x.minutes)).toEqual([45, 45, 30]);
    expect(s.stats.scheduledMinutes).toBe(120);
    expect(s.unscheduled).toHaveLength(0);
    // Ngày đầu: 19:00–19:45, nghỉ 10 phút, 19:55–20:40
    expect(s.sessions[0]).toMatchObject({ startTime: '19:00', endTime: '19:45' });
    expect(s.sessions[1]).toMatchObject({ startTime: '19:55', endTime: '20:40' });
  });

  it('gộp phần dư < 15 phút vào phiên trước, không tạo phiên lẻ', () => {
    const s = generateSchedule([makeTask({ estimatedMinutes: 95 })], { ...EVERYDAY, slots: [{ start: '19:00', end: '22:00' }] }, { now: NOW });
    expect(s.sessions.map((x) => x.minutes)).toEqual([45, 50]);
  });

  it('chỉ xếp phần thời gian còn lại (ước tính − đã học)', () => {
    const s = generateSchedule([makeTask({ estimatedMinutes: 120, actualMinutes: 90 })], EVERYDAY, { now: NOW });
    expect(s.stats.requiredMinutes).toBe(30);
    expect(s.stats.scheduledMinutes).toBe(30);
  });

  it('không có hai phiên nào trùng giờ', () => {
    const tasks = [
      makeTask({ id: 'a', estimatedMinutes: 200, importance: 'high' }),
      makeTask({ id: 'b', estimatedMinutes: 150, difficulty: 'hard' }),
      makeTask({ id: 'c', estimatedMinutes: 90, deadline: at(2, 23) }),
    ];
    const s = generateSchedule(tasks, { ...EVERYDAY, slots: [{ start: '08:00', end: '10:00' }, { start: '19:00', end: '22:00' }] }, { now: NOW });
    const ivs = s.sessions.map(interval).sort((x, y) => x.start - y.start);
    for (let i = 1; i < ivs.length; i++) expect(ivs[i].start).toBeGreaterThanOrEqual(ivs[i - 1].end);
  });

  it('không bao giờ xếp phiên kết thúc sau deadline', () => {
    const deadline = at(1, 20, 0); // ngày mai 20:00
    const s = generateSchedule([makeTask({ estimatedMinutes: 300, deadline })], EVERYDAY, { now: NOW });
    for (const x of s.sessions) expect(interval(x).end).toBeLessThanOrEqual(new Date(deadline).getTime());
    // Hôm nay 120 phút rảnh (trừ nghỉ) + mai 19:00–20:00 => không đủ 300 phút
    expect(s.unscheduled).toHaveLength(1);
    expect(s.unscheduled[0].missingMinutes).toBeGreaterThan(0);
  });

  it('cảnh báo khi khối lượng vượt quá thời gian rảnh', () => {
    const s = generateSchedule([makeTask({ estimatedMinutes: 600, deadline: at(1, 23, 59) })], EVERYDAY, { now: NOW });
    expect(s.warnings.some((w) => w.includes('vượt quá thời gian rảnh'))).toBe(true);
    expect(s.unscheduled[0].reason).toMatch(/Không đủ thời gian rảnh trước deadline/);
  });

  it('task quá hạn không được xếp lịch và được báo lý do', () => {
    const s = generateSchedule([makeTask({ deadline: at(-1, 23) })], EVERYDAY, { now: NOW });
    expect(s.sessions).toHaveLength(0);
    expect(s.unscheduled[0].reason).toMatch(/quá hạn/);
  });

  it('task đã hoàn thành bị bỏ qua', () => {
    const s = generateSchedule([makeTask({ status: 'completed' })], EVERYDAY, { now: NOW });
    expect(s.sessions).toHaveLength(0);
    expect(s.stats.requiredMinutes).toBe(0);
  });

  it('task ưu tiên cao hơn được xếp vào khung sớm hơn', () => {
    const low = makeTask({ id: 'low', importance: 'low', difficulty: 'easy', estimatedMinutes: 45, deadline: at(10, 23) });
    const high = makeTask({ id: 'high', importance: 'high', difficulty: 'hard', estimatedMinutes: 45, deadline: at(2, 23) });
    const s = generateSchedule([low, high], EVERYDAY, { now: NOW });
    expect(s.sessions[0].taskId).toBe('high');
    expect(s.sessions[1].taskId).toBe('low');
  });

  it('báo lỗi khi không có ngày học / khung giờ nào', () => {
    const s = generateSchedule([makeTask()], { ...EVERYDAY, days: [] }, { now: NOW });
    expect(s.sessions).toHaveLength(0);
    expect(s.warnings[0]).toMatch(/chưa chọn ngày học/);
  });

  it('không xếp chồng lên phiên được giữ lại', () => {
    const keep: StudySession = { id: 'k', taskId: 'x', subjectId: 's1', date: '2026-11-04', startTime: '19:00', endTime: '19:45', minutes: 45, completed: true, origin: 'scheduler' };
    const s = generateSchedule([makeTask({ estimatedMinutes: 45 })], EVERYDAY, { now: NOW, keepSessions: [keep] });
    // Phải bắt đầu sau 19:45 + 10 phút nghỉ
    expect(s.sessions[0]).toMatchObject({ date: '2026-11-04', startTime: '19:55' });
  });

  it('phạm vi lập lịch mặc định theo deadline xa nhất, tối đa 28 ngày', () => {
    expect(defaultHorizonDays([makeTask({ deadline: at(3, 10) })], NOW)).toBe(4);
    expect(defaultHorizonDays([makeTask({ deadline: at(60, 10) })], NOW)).toBe(28);
  });

  it('chữ ký đầu vào đổi khi task hoặc thời gian rảnh đổi', () => {
    const t = makeTask();
    const base = computeScheduleSignature([t], EVERYDAY);
    expect(computeScheduleSignature([t], EVERYDAY)).toBe(base);
    expect(computeScheduleSignature([{ ...t, estimatedMinutes: 200 }], EVERYDAY)).not.toBe(base);
    expect(computeScheduleSignature([t], { ...EVERYDAY, sessionMinutes: 60 })).not.toBe(base);
  });
});
