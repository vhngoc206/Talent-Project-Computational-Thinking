import { describe, expect, it } from 'vitest';
import { createSeedData } from '../../services/seedData';
import { selectTodaysTasks, selectUpcomingDeadlines, filterAndSortTasks, DEFAULT_FILTERS } from '../tasks/taskSelectors';
import { toDateKey } from '../../utils/date';
import { computeOverview, computeStatusBreakdown, computeStudyBySubject, computeWeeklyStudy } from './stats';

// Giữa trưa để mọi mốc "hôm nay 21:00" của dữ liệu mẫu đều còn ở tương lai
const NOW = new Date(2026, 10, 4, 12, 0, 0);

describe('computeOverview – số liệu dashboard tính từ dữ liệu thực', () => {
  const data = createSeedData(NOW);
  const o = computeOverview(data.tasks, NOW);

  it('đếm đúng task theo trạng thái', () => {
    expect(o.totalTasks).toBe(data.tasks.length);
    expect(o.completedTasks).toBe(3);
    expect(o.pendingTasks).toBe(data.tasks.length - 3);
    expect(o.completedTasks + o.pendingTasks).toBe(o.totalTasks);
  });

  it('đếm task quá hạn (chưa xong, deadline đã qua)', () => {
    expect(o.overdueTasks).toBe(1);
  });

  it('completion rate và tổng giờ học nhất quán với dữ liệu', () => {
    expect(o.completionRate).toBe(Math.round((3 / data.tasks.length) * 100));
    expect(o.totalStudyMinutes).toBe(data.sessions.reduce((s, x) => s + x.minutes, 0));
    expect(o.progressPercent).toBeGreaterThan(0);
    expect(o.progressPercent).toBeLessThanOrEqual(100);
  });

  it('danh sách rỗng không gây lỗi chia cho 0', () => {
    const empty = computeOverview([], NOW);
    expect(empty.completionRate).toBe(0);
    expect(empty.progressPercent).toBe(0);
  });

  it('dashboard cập nhật khi dữ liệu thay đổi: hoàn thành thêm 1 task => số liệu đổi theo', () => {
    const tasks = data.tasks.map((t, i) => (i === 1 ? { ...t, status: 'completed' as const } : t));
    const after = computeOverview(tasks, NOW);
    expect(after.completedTasks).toBe(o.completedTasks + 1);
    expect(after.pendingTasks).toBe(o.pendingTasks - 1);
  });
});

describe('computeWeeklyStudy', () => {
  it('trả về 7 ngày kết thúc hôm nay, cộng đúng số phút theo ngày', () => {
    const data = createSeedData(NOW);
    const week = computeWeeklyStudy(data.sessions, NOW);
    expect(week).toHaveLength(7);
    expect(week.at(-1)?.isToday).toBe(true);
    expect(week.at(-1)?.dateKey).toBe(toDateKey(NOW));
    expect(week.reduce((s, d) => s + d.minutes, 0)).toBe(data.sessions.reduce((s, x) => s + x.minutes, 0));
  });

  it('không tính phiên chưa học (completed = false)', () => {
    const week = computeWeeklyStudy(
      [{ id: 'a', taskId: 't', subjectId: 's', date: toDateKey(NOW), startTime: '19:00', endTime: '19:45', minutes: 45, completed: false, origin: 'scheduler' }],
      NOW,
    );
    expect(week.reduce((s, d) => s + d.minutes, 0)).toBe(0);
  });
});

describe('computeStatusBreakdown / computeStudyBySubject', () => {
  const data = createSeedData(NOW);
  it('tổng số task theo trạng thái bằng tổng task', () => {
    expect(computeStatusBreakdown(data.tasks).reduce((s, x) => s + x.count, 0)).toBe(data.tasks.length);
  });
  it('tổng thời gian theo môn bằng tổng thời gian học', () => {
    const total = computeStudyBySubject(data.tasks, data.subjects).reduce((s, x) => s + x.minutes, 0);
    expect(total).toBe(data.tasks.reduce((s, t) => s + t.actualMinutes, 0));
  });
});

describe('taskSelectors', () => {
  const data = createSeedData(NOW);

  it('"Việc hôm nay" gồm task quá hạn / đến hạn hôm nay / đang làm, không có task đã xong', () => {
    const today = selectTodaysTasks(data.tasks, NOW, 50);
    expect(today.length).toBeGreaterThan(0);
    expect(today.every((r) => r.task.status !== 'completed')).toBe(true);
    // thứ tự theo điểm ưu tiên giảm dần
    const scores = today.map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('deadline sắp tới sắp theo thời gian tăng dần', () => {
    const upcoming = selectUpcomingDeadlines(data.tasks, 20);
    const times = upcoming.map((t) => new Date(t.deadline).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('lọc theo môn học và trạng thái', () => {
    const bySubject = filterAndSortTasks(data.tasks, data.subjects, { ...DEFAULT_FILTERS, subjectId: 'sub-db' }, NOW);
    expect(bySubject.every((t) => t.subjectId === 'sub-db')).toBe(true);
    const byStatus = filterAndSortTasks(data.tasks, data.subjects, { ...DEFAULT_FILTERS, status: 'completed' }, NOW);
    expect(byStatus).toHaveLength(3);
  });

  it('tìm kiếm không phân biệt dấu tiếng Việt', () => {
    const found = filterAndSortTasks(data.tasks, data.subjects, { ...DEFAULT_FILTERS, search: 'co so du lieu' }, NOW);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((t) => t.subjectId === 'sub-db')).toBe(true);
  });

  it('sắp xếp theo deadline tăng / giảm dần', () => {
    const asc = filterAndSortTasks(data.tasks, data.subjects, { ...DEFAULT_FILTERS, sort: 'deadline_asc' }, NOW);
    const desc = filterAndSortTasks(data.tasks, data.subjects, { ...DEFAULT_FILTERS, sort: 'deadline_desc' }, NOW);
    expect(asc.map((t) => t.id)).toEqual([...desc].reverse().map((t) => t.id));
    const times = asc.map((t) => new Date(t.deadline).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('sắp xếp theo ưu tiên: task chưa xong trước (đúng thứ tự Priority Engine), task đã xong cuối cùng', () => {
    const list = filterAndSortTasks(data.tasks, data.subjects, DEFAULT_FILTERS, NOW);
    const firstDone = list.findIndex((t) => t.status === 'completed');
    expect(list.slice(firstDone).every((t) => t.status === 'completed')).toBe(true);
    expect(list).toHaveLength(data.tasks.length);
  });
});
