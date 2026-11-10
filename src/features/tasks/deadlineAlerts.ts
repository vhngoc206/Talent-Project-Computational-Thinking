/** Cảnh báo sắp tới deadline (hàm thuần, có test). */
import type { Task } from '../../types';

/** Báo trước bao nhiêu phút */
export const ALERT_BEFORE_MINUTES = 60;

export interface DueSoon {
  task: Task;
  minutesLeft: number;
}

/** Nhiệm vụ chưa xong có deadline trong `windowMinutes` phút tới (chưa quá hạn), gần nhất trước */
export function dueSoon(tasks: Task[], now: Date, windowMinutes = ALERT_BEFORE_MINUTES): DueSoon[] {
  return tasks
    .filter((t) => t.status !== 'completed')
    .map((task) => ({ task, minutesLeft: (new Date(task.deadline).getTime() - now.getTime()) / 60_000 }))
    .filter((x) => x.minutesLeft > 0 && x.minutesLeft <= windowMinutes)
    .sort((a, b) => a.minutesLeft - b.minutesLeft);
}

/** Khóa nhớ đã báo: đổi deadline thì báo lại */
export const alertKey = (t: Task) => `${t.id}@${t.deadline}`;

/** "45 phút" / "1 tiếng" */
export function formatMinutesLeft(minutes: number): string {
  const m = Math.max(1, Math.ceil(minutes));
  return m >= 60 ? '1 tiếng' : `${m} phút`;
}
