/**
 * Các phép tính thống kê – hàm thuần, dữ liệu lấy hoàn toàn từ tasks/sessions thực tế.
 * Dashboard (và trang Analytics ở Phase 5) chỉ hiển thị kết quả của file này.
 */
import { WEEKDAY_SHORT, STATUS_LABEL } from '../../constants';
import { isOverdue, SOON_DAYS } from '../../algorithms/priorityScheduler';
import type { StudySession, Subject, Task, TaskStatus } from '../../types';
import { addDays, daysUntil, toDateKey } from '../../utils/date';

export interface Overview {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  /** Số deadline trong SOON_DAYS ngày tới (chưa quá hạn, chưa hoàn thành) */
  upcomingDeadlines: number;
  /** % task đã hoàn thành (0–100) */
  completionRate: number;
  /** Tổng phút học thực tế */
  totalStudyMinutes: number;
  /**
   * Tiến độ học tập (0–100) tính theo THỜI GIAN:
   * task hoàn thành tính đủ thời gian ước tính; task còn lại tính min(đã học, ước tính).
   */
  progressPercent: number;
}

export function computeOverview(tasks: Task[], now: Date): Overview {
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const pending = tasks.filter((t) => t.status !== 'completed');
  const totalEstimated = tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
  const doneMinutes = tasks.reduce(
    (sum, t) => sum + (t.status === 'completed' ? t.estimatedMinutes : Math.min(t.actualMinutes, t.estimatedMinutes)),
    0,
  );

  return {
    totalTasks: tasks.length,
    completedTasks,
    pendingTasks: pending.length,
    overdueTasks: pending.filter((t) => isOverdue(t, now)).length,
    upcomingDeadlines: pending.filter((t) => {
      const d = daysUntil(t.deadline, now);
      return d >= 0 && d <= SOON_DAYS;
    }).length,
    completionRate: tasks.length === 0 ? 0 : Math.round((completedTasks / tasks.length) * 100),
    totalStudyMinutes: tasks.reduce((sum, t) => sum + t.actualMinutes, 0),
    progressPercent: totalEstimated === 0 ? 0 : Math.round((doneMinutes / totalEstimated) * 100),
  };
}

export interface DayStudy {
  dateKey: string;
  /** Nhãn thứ: T2…CN */
  label: string;
  minutes: number;
  isToday: boolean;
}

/** Thời gian học của 7 ngày gần nhất (kết thúc ở hôm nay), chỉ tính các phiên ĐÃ học. */
export function computeWeeklyStudy(sessions: StudySession[], now: Date, days = 7): DayStudy[] {
  const byDate = new Map<string, number>();
  for (const s of sessions) {
    if (!s.completed) continue;
    byDate.set(s.date, (byDate.get(s.date) ?? 0) + s.minutes);
  }
  const todayKey = toDateKey(now);
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(now, i - (days - 1));
    const dateKey = toDateKey(date);
    return {
      dateKey,
      label: WEEKDAY_SHORT[date.getDay()],
      minutes: byDate.get(dateKey) ?? 0,
      isToday: dateKey === todayKey,
    };
  });
}

export interface StatusSlice {
  status: TaskStatus;
  label: string;
  count: number;
}

export function computeStatusBreakdown(tasks: Task[]): StatusSlice[] {
  const order: TaskStatus[] = ['completed', 'in_progress', 'todo'];
  return order.map((status) => ({
    status,
    label: STATUS_LABEL[status],
    count: tasks.filter((t) => t.status === status).length,
  }));
}

export interface SubjectStudy {
  subjectId: string;
  name: string;
  color: string;
  minutes: number;
}

/** Thời gian học thực tế theo môn (biểu đồ Subject Distribution). */
export function computeStudyBySubject(tasks: Task[], subjects: Subject[]): SubjectStudy[] {
  return subjects
    .map((s) => ({
      subjectId: s.id,
      name: s.name,
      color: s.color,
      minutes: tasks.filter((t) => t.subjectId === s.id).reduce((sum, t) => sum + t.actualMinutes, 0),
    }))
    .sort((a, b) => b.minutes - a.minutes);
}

export interface SubjectProgress {
  subject: Subject;
  totalTasks: number;
  completedTasks: number;
  estimatedMinutes: number;
  actualMinutes: number;
}

/** Bảng tiến độ theo môn: số task, đã xong, giờ ước tính vs giờ đã học. */
export function computeSubjectProgress(tasks: Task[], subjects: Subject[]): SubjectProgress[] {
  return subjects.map((subject) => {
    const list = tasks.filter((t) => t.subjectId === subject.id);
    return {
      subject,
      totalTasks: list.length,
      completedTasks: list.filter((t) => t.status === 'completed').length,
      estimatedMinutes: list.reduce((s, t) => s + t.estimatedMinutes, 0),
      actualMinutes: list.reduce((s, t) => s + t.actualMinutes, 0),
    };
  });
}

export interface WeekPerformance {
  /** 'YYYY-MM-DD' của thứ hai đầu tuần */
  weekStart: string;
  /** "28/10–03/11" */
  label: string;
  minutes: number;
  completedTasks: number;
  isCurrent: boolean;
}

/** Thứ hai (0h) của tuần chứa `date` */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** Hiệu suất theo tuần (T2–CN): giờ học + số task hoàn thành, `weeks` tuần gần nhất. */
export function computeWeeklyPerformance(tasks: Task[], sessions: StudySession[], now: Date, weeks = 6): WeekPerformance[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  const thisWeek = startOfWeek(now);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(thisWeek, (i - (weeks - 1)) * 7);
    const end = addDays(start, 7);
    const startKey = toDateKey(start);
    const endKey = toDateKey(end);
    const last = addDays(start, 6);
    return {
      weekStart: startKey,
      label: `${pad(start.getDate())}/${pad(start.getMonth() + 1)}–${pad(last.getDate())}/${pad(last.getMonth() + 1)}`,
      minutes: sessions.filter((s) => s.completed && s.date >= startKey && s.date < endKey).reduce((sum, s) => sum + s.minutes, 0),
      completedTasks: tasks.filter((t) => {
        if (!t.completedAt) return false;
        const at = new Date(t.completedAt).getTime();
        return at >= start.getTime() && at < end.getTime();
      }).length,
      isCurrent: i === weeks - 1,
    };
  });
}
