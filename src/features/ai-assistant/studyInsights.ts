/**
 * Phân tích dữ liệu học tập thực tế (hàm thuần) – dùng cho:
 *  - Demo Mode (câu trả lời dự phòng bằng logic), và
 *  - ngữ cảnh gửi cho Gemini (để AI trả lời dựa trên dữ liệu thật).
 *
 * Kết hợp hai thuật toán của ứng dụng: Priority Engine (xếp hạng) và Greedy Scheduler
 * (mô phỏng lịch với thời gian rảnh hiện tại để biết task nào không kịp).
 */
import { generateSchedule, MAX_HORIZON_DAYS, remainingMinutesOf } from '../../algorithms/greedyScheduler';
import { busyIntervals } from '../../utils/events';
import { rankTasks, type PriorityResult } from '../../algorithms/priorityScheduler';
import type { AppData, StudySchedule, StudySession, Subject } from '../../types';
import { addDays, formatMinutes } from '../../utils/date';
import { computeOverview, computeWeeklyStudy, type Overview } from '../analytics/stats';

export type RiskLevel = 'overdue' | 'high' | 'medium' | 'none';

export interface TaskInsight {
  result: PriorityResult;
  subject: Subject | undefined;
  /** Phút còn phải học */
  remainingMinutes: number;
  /** Phút xếp được trong lịch mô phỏng */
  scheduledMinutes: number;
  /** Phút không xếp được trước deadline */
  missingMinutes: number;
  /** Số phiên cần (theo độ dài phiên người dùng chọn) */
  sessionsNeeded: number;
  /** Phiên đầu tiên trong lịch mô phỏng */
  firstSession: StudySession | undefined;
  risk: RiskLevel;
  riskReason: string;
}

export interface StudyInsights {
  insights: TaskInsight[];
  atRisk: TaskInsight[];
  simulation: StudySchedule;
  overview: Overview;
  last7DaysMinutes: number;
}

export function computeInsights(data: AppData, now: Date): StudyInsights {
  const ranked = rankTasks(data.tasks, now);
  const simulation = generateSchedule(data.tasks, data.availability, { now, busy: busyIntervals(data.events, now, addDays(now, MAX_HORIZON_DAYS + 1)) });
  const subjectById = new Map(data.subjects.map((s) => [s.id, s]));

  const insights: TaskInsight[] = ranked.map((result) => {
    const t = result.task;
    const remaining = remainingMinutesOf(t);
    const sessions = simulation.sessions.filter((s) => s.taskId === t.id);
    const scheduled = sessions.reduce((sum, s) => sum + s.minutes, 0);
    const missing = simulation.unscheduled.find((u) => u.taskId === t.id)?.missingMinutes ?? 0;

    let risk: RiskLevel = 'none';
    let riskReason = '';
    if (result.daysLeft < 0) {
      risk = 'overdue';
      riskReason = `Đã quá hạn, còn ${formatMinutes(remaining)} chưa học.`;
    } else if (missing > 0) {
      risk = 'high';
      riskReason = `Thời gian rảnh trước deadline không đủ – thiếu ${formatMinutes(missing)}.`;
    } else if (result.daysLeft < 3 && remaining >= 60) {
      risk = 'medium';
      riskReason = `Deadline dưới 3 ngày mà còn ${formatMinutes(remaining)} phải học.`;
    }

    return {
      result,
      subject: subjectById.get(t.subjectId),
      remainingMinutes: remaining,
      scheduledMinutes: scheduled,
      missingMinutes: missing,
      sessionsNeeded: Math.ceil(remaining / data.availability.sessionMinutes),
      firstSession: sessions[0],
      risk,
      riskReason,
    };
  });

  const order: Record<RiskLevel, number> = { overdue: 0, high: 1, medium: 2, none: 3 };
  const atRisk = insights.filter((i) => i.risk !== 'none').sort((a, b) => order[a.risk] - order[b.risk]);

  return {
    insights,
    atRisk,
    simulation,
    overview: computeOverview(data.tasks, now),
    last7DaysMinutes: computeWeeklyStudy(data.sessions, now).reduce((s, d) => s + d.minutes, 0),
  };
}
