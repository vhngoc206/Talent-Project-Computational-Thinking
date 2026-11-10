import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import {
  calculatePriority,
  getDeadlineScore,
  getDeadlineUrgency,
  getPriorityLevel,
  isOverdue,
  rankTasks,
} from './priorityScheduler';

const NOW = new Date('2026-11-04T08:00:00.000Z');
const daysFromNow = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't',
    title: 'Task',
    subjectId: 's',
    description: '',
    deadline: daysFromNow(10),
    estimatedMinutes: 60,
    actualMinutes: 0,
    difficulty: 'easy',
    importance: 'low',
    status: 'todo',
    createdAt: '2026-11-01T00:00:00.000Z',
    completedAt: null,
    ...overrides,
  };
}

describe('getDeadlineScore – chuẩn hóa deadline về thang 1–3', () => {
  it('trên 7 ngày = 1', () => {
    expect(getDeadlineScore(7.01)).toBe(1);
    expect(getDeadlineScore(30)).toBe(1);
  });
  it('từ 3 đến 7 ngày = 2 (gồm cả hai mốc biên)', () => {
    expect(getDeadlineScore(7)).toBe(2);
    expect(getDeadlineScore(5)).toBe(2);
    expect(getDeadlineScore(3)).toBe(2);
  });
  it('dưới 3 ngày hoặc quá hạn = 3', () => {
    expect(getDeadlineScore(2.99)).toBe(3);
    expect(getDeadlineScore(0)).toBe(3);
    expect(getDeadlineScore(-2)).toBe(3);
  });
});

describe('calculatePriority – điểm ưu tiên chính xác theo công thức', () => {
  it('thấp nhất: deadline xa + low + easy = 0.4×1 + 0.3×1 + 0.3×1 = 1.0', () => {
    const r = calculatePriority(makeTask(), NOW);
    expect(r.score).toBe(1);
    expect(r.level).toBe('low');
  });

  it('cao nhất: quá hạn + high + hard = 0.4×3 + 0.3×3 + 0.3×3 = 3.0', () => {
    const r = calculatePriority(makeTask({ deadline: daysFromNow(-1), importance: 'high', difficulty: 'hard' }), NOW);
    expect(r.score).toBe(3);
    expect(r.level).toBe('critical');
  });

  it('ví dụ hỗn hợp: còn 5 ngày (2) + medium (2) + hard (3) = 0.8 + 0.6 + 0.9 = 2.3', () => {
    const r = calculatePriority(makeTask({ deadline: daysFromNow(5), importance: 'medium', difficulty: 'hard' }), NOW);
    expect(r.deadlineScore).toBe(2);
    expect(r.importanceScore).toBe(2);
    expect(r.difficultyScore).toBe(3);
    expect(r.score).toBe(2.3);
    expect(r.level).toBe('high');
  });

  it('có lý do giải thích cho điểm ưu tiên', () => {
    const r = calculatePriority(makeTask({ deadline: daysFromNow(-2), importance: 'high' }), NOW);
    expect(r.reasons.length).toBe(3);
    expect(r.reasons[0]).toContain('Quá hạn');
    expect(r.reasons[1]).toContain('quan trọng cao');
  });
});

describe('getPriorityLevel', () => {
  it('phân mức theo ngưỡng 2.5 / 2.0 / 1.5', () => {
    expect(getPriorityLevel(2.5)).toBe('critical');
    expect(getPriorityLevel(2.4)).toBe('high');
    expect(getPriorityLevel(1.5)).toBe('medium');
    expect(getPriorityLevel(1.4)).toBe('low');
  });
});

describe('rankTasks – sắp xếp theo độ ưu tiên', () => {
  it('xếp giảm dần theo điểm', () => {
    const low = makeTask({ id: 'low' });
    const high = makeTask({ id: 'high', deadline: daysFromNow(1), importance: 'high', difficulty: 'hard' });
    const mid = makeTask({ id: 'mid', deadline: daysFromNow(5), importance: 'medium' });
    expect(rankTasks([low, high, mid], NOW).map((r) => r.task.id)).toEqual(['high', 'mid', 'low']);
  });

  it('bằng điểm thì deadline gần hơn đứng trước', () => {
    // Cả hai: deadline score 3 + medium + medium = 2.4 – chỉ khác giờ deadline
    const later = makeTask({ id: 'later', deadline: daysFromNow(2), importance: 'medium', difficulty: 'medium' });
    const sooner = makeTask({ id: 'sooner', deadline: daysFromNow(1), importance: 'medium', difficulty: 'medium' });
    const ranked = rankTasks([later, sooner], NOW);
    expect(ranked[0].score).toBe(ranked[1].score);
    expect(ranked.map((r) => r.task.id)).toEqual(['sooner', 'later']);
  });

  it('loại bỏ task đã hoàn thành khỏi danh sách ưu tiên', () => {
    const done = makeTask({ id: 'done', status: 'completed', deadline: daysFromNow(-1), importance: 'high' });
    const todo = makeTask({ id: 'todo' });
    const doing = makeTask({ id: 'doing', status: 'in_progress' });
    const ids = rankTasks([done, todo, doing], NOW).map((r) => r.task.id);
    expect(ids).not.toContain('done');
    expect(ids).toHaveLength(2);
  });

  it('không thay đổi mảng đầu vào và trả mảng rỗng khi không có task', () => {
    const input = [makeTask({ id: 'a' }), makeTask({ id: 'b', importance: 'high' })];
    const snapshot = input.map((t) => t.id);
    rankTasks(input, NOW);
    expect(input.map((t) => t.id)).toEqual(snapshot);
    expect(rankTasks([], NOW)).toEqual([]);
  });
});

describe('getDeadlineUrgency / isOverdue – màu cảnh báo deadline', () => {
  it('đỏ khi quá hạn hoặc dưới 3 ngày', () => {
    expect(getDeadlineUrgency(makeTask({ deadline: daysFromNow(-1) }), NOW)).toBe('danger');
    expect(getDeadlineUrgency(makeTask({ deadline: daysFromNow(2) }), NOW)).toBe('danger');
  });
  it('cam khi 3–7 ngày, xanh khi còn nhiều thời gian', () => {
    expect(getDeadlineUrgency(makeTask({ deadline: daysFromNow(5) }), NOW)).toBe('warning');
    expect(getDeadlineUrgency(makeTask({ deadline: daysFromNow(12) }), NOW)).toBe('safe');
  });
  it('task đã hoàn thành không bị cảnh báo và không bao giờ quá hạn', () => {
    const done = makeTask({ status: 'completed', deadline: daysFromNow(-5) });
    expect(getDeadlineUrgency(done, NOW)).toBe('done');
    expect(isOverdue(done, NOW)).toBe(false);
    expect(isOverdue(makeTask({ deadline: daysFromNow(-0.1) }), NOW)).toBe(true);
  });
});
