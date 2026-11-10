/** Lọc / tìm kiếm / sắp xếp danh sách nhiệm vụ + các danh sách dùng trên Dashboard. Hàm thuần. */
import { rankTasks } from '../../algorithms/priorityScheduler';
import type { PriorityResult } from '../../algorithms/priorityScheduler';
import type { Subject, Task, TaskStatus } from '../../types';
import { endOfDay } from '../../utils/date';
import { normalizeText } from '../../utils/text';

export type TaskSort = 'priority' | 'deadline_asc' | 'deadline_desc';

export interface TaskFilters {
  search: string;
  subjectId: string | 'all';
  status: TaskStatus | 'all';
  sort: TaskSort;
}

export const DEFAULT_FILTERS: TaskFilters = { search: '', subjectId: 'all', status: 'all', sort: 'priority' };

const byDeadline = (a: Task, b: Task) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime();

export function filterAndSortTasks(
  tasks: Task[],
  subjects: Subject[],
  filters: TaskFilters,
  now: Date,
): Task[] {
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const query = normalizeText(filters.search);

  const filtered = tasks.filter((t) => {
    if (filters.subjectId !== 'all' && t.subjectId !== filters.subjectId) return false;
    if (filters.status !== 'all' && t.status !== filters.status) return false;
    if (query) {
      const subject = subjectById.get(t.subjectId);
      const haystack = normalizeText(`${t.title} ${t.description} ${subject?.name ?? ''} ${subject?.code ?? ''}`);
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  switch (filters.sort) {
    case 'deadline_asc':
      return [...filtered].sort(byDeadline);
    case 'deadline_desc':
      return [...filtered].sort((a, b) => byDeadline(b, a));
    case 'priority':
    default: {
      // Task chưa xong theo thứ tự của Priority Engine, task đã xong xuống cuối (mới hoàn thành trước)
      const ranked = rankTasks(filtered, now).map((r) => r.task);
      const done = filtered
        .filter((t) => t.status === 'completed')
        .sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime());
      return [...ranked, ...done];
    }
  }
}

/**
 * "Việc hôm nay": task chưa xong mà đã quá hạn, đến hạn trong hôm nay, hoặc đang làm dở.
 * Xếp theo điểm ưu tiên.
 */
export function selectTodaysTasks(tasks: Task[], now: Date, limit = 5): PriorityResult[] {
  const endToday = endOfDay(now).getTime();
  const candidates = tasks.filter(
    (t) => t.status !== 'completed' && (new Date(t.deadline).getTime() <= endToday || t.status === 'in_progress'),
  );
  return rankTasks(candidates, now).slice(0, limit);
}

/** Các deadline gần nhất (kể cả đã quá hạn nhưng chưa xong), sắp theo thời gian. */
export function selectUpcomingDeadlines(tasks: Task[], limit = 5): Task[] {
  return tasks
    .filter((t) => t.status !== 'completed')
    .sort(byDeadline)
    .slice(0, limit);
}
