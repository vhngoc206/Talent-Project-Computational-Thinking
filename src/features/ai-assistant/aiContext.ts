/**
 * Đóng gói dữ liệu THẬT của ứng dụng thành ngữ cảnh gửi cho Gemini,
 * để AI trả lời dựa trên dữ liệu người dùng chứ không tự bịa.
 */
import { WEEKDAY_LONG } from '../../constants';
import type { AppData } from '../../types';
import { slotsForDay } from '../../utils/availability';
import { isoToLocalInput, toDateKey } from '../../utils/date';
import type { StudyInsights } from './studyInsights';

export function localNowText(now: Date): string {
  const offset = -now.getTimezoneOffset() / 60;
  return `${WEEKDAY_LONG[now.getDay()]}, ${isoToLocalInput(now.toISOString()).replace('T', ' ')} (UTC${offset >= 0 ? '+' : ''}${offset})`;
}

export function buildAiContext(data: AppData, ins: StudyInsights, now: Date) {
  const subjectCode = new Map(data.subjects.map((s) => [s.id, s.code]));
  return {
    currentTime: localNowText(now),
    subjects: data.subjects.map((s) => ({ id: s.id, code: s.code, name: s.name, difficulty: s.difficulty })),
    pendingTasks: ins.insights.map((i, idx) => ({
      id: i.result.task.id,
      title: i.result.task.title,
      subject: subjectCode.get(i.result.task.subjectId),
      deadline: isoToLocalInput(i.result.task.deadline),
      status: i.result.task.status,
      estimatedMinutes: i.result.task.estimatedMinutes,
      actualMinutes: i.result.task.actualMinutes,
      remainingMinutes: i.remainingMinutes,
      difficulty: i.result.task.difficulty,
      importance: i.result.task.importance,
      priorityRank: idx + 1,
      priorityScore: i.result.score,
      daysLeft: Math.round(i.result.daysLeft * 10) / 10,
      risk: i.risk,
      riskReason: i.riskReason || undefined,
    })),
    completedTasks: data.tasks.filter((t) => t.status === 'completed').map((t) => ({ id: t.id, title: t.title, subject: subjectCode.get(t.subjectId) })),
    availability: {
      // Giờ rảnh theo từng thứ trong tuần
      byWeekday: [1, 2, 3, 4, 5, 6, 0]
        .map((d) => ({ day: WEEKDAY_LONG[d], slots: slotsForDay(data.availability, d) }))
        .filter((x) => x.slots.length > 0),
      sessionMinutes: data.availability.sessionMinutes,
      breakMinutes: data.availability.breakMinutes,
    },
    greedySchedulerSimulation: {
      horizonDays: ins.simulation.stats.horizonDays,
      requiredMinutes: ins.simulation.stats.requiredMinutes,
      capacityMinutes: ins.simulation.stats.capacityMinutes,
      scheduledMinutes: ins.simulation.stats.scheduledMinutes,
      unscheduled: ins.simulation.unscheduled,
      firstSessions: ins.simulation.sessions.slice(0, 12).map((s) => ({ date: s.date, start: s.startTime, end: s.endTime, taskId: s.taskId })),
    },
    savedSchedule: data.schedule
      ? {
          generatedAt: isoToLocalInput(data.schedule.generatedAt),
          upcomingSessions: data.schedule.sessions
            .filter((s) => s.date >= toDateKey(now))
            .slice(0, 12)
            .map((s) => ({ date: s.date, start: s.startTime, end: s.endTime, taskId: s.taskId, completed: s.completed })),
        }
      : null,
    stats: {
      completionRate: ins.overview.completionRate,
      overdueTasks: ins.overview.overdueTasks,
      studyMinutesLast7Days: ins.last7DaysMinutes,
    },
  };
}
