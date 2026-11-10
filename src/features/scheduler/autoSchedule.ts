/**
 * Quy tắc TỰ ĐỘNG xếp lại lịch học (hàm thuần, có test):
 *  - 'initial': chưa có lịch mà còn nhiệm vụ chưa xong,
 *  - 'stale'  : nhiệm vụ / giờ rảnh / sự kiện đã đổi so với lúc tạo lịch,
 *  - 'missed' : có phiên học đã qua giờ mà chưa tick => dời phần chưa học sang giờ rảnh kế tiếp.
 * Greedy Scheduler luôn tính "còn phải học = dự kiến − đã học" và nhiệm vụ chưa tick vẫn được xếp tiếp,
 * nên xếp lại là đủ để dời việc chưa xong sang những ngày sau.
 */
import { computeScheduleSignature } from '../../algorithms/greedyScheduler';
import type { AppData, StudySession } from '../../types';
import { dateAt } from '../../utils/events';

export type RescheduleReason = 'initial' | 'stale' | 'missed';

/** Thời điểm kết thúc phiên; giờ kết thúc ≤ giờ bắt đầu (vd 23:00–00:00) nghĩa là hết lúc nửa đêm */
export function sessionEnd(s: StudySession): Date {
  const end = dateAt(s.date, s.endTime ?? '23:59');
  if (s.startTime && s.endTime && s.endTime <= s.startTime) end.setDate(end.getDate() + 1);
  return end;
}

/** Phiên trong lịch đã kết thúc mà chưa được đánh dấu đã học */
export function missedSessions(sessions: StudySession[], now: Date): StudySession[] {
  return sessions.filter((s) => !s.completed && s.endTime && sessionEnd(s).getTime() <= now.getTime());
}

export function rescheduleReason(data: AppData, now: Date): RescheduleReason | null {
  if (data.availability.autoReschedule === false) return null;
  const pending = data.tasks.some((t) => t.status !== 'completed');
  if (!data.schedule) return pending ? 'initial' : null;
  if (data.schedule.inputSignature !== computeScheduleSignature(data.tasks, data.availability, data.events)) return 'stale';
  if (missedSessions(data.schedule.sessions, now).length > 0) return 'missed';
  return null;
}
