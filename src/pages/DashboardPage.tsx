import { useMemo } from 'react';
import { rankTasks, SOON_DAYS } from '../algorithms/priorityScheduler';
import { AiAssistantCard } from '../features/dashboard/AiAssistantCard';
import { HeroCard } from '../features/dashboard/HeroCard';
import { TodayTasks } from '../features/dashboard/TodayTasks';
import { UpcomingDeadlines } from '../features/dashboard/UpcomingDeadlines';
import { computeOverview, computeStatusBreakdown, computeWeeklyStudy } from '../features/analytics/stats';
import { TaskCompletionChart } from '../features/analytics/TaskCompletionChart';
import { WeeklyStudyChart } from '../features/analytics/WeeklyStudyChart';
import { FocusCard } from '../features/dashboard/FocusCard';
import { TodayEvents } from '../features/dashboard/TodayEvents';
import { selectTodaysTasks, selectUpcomingDeadlines } from '../features/tasks/taskSelectors';
import { useNow } from '../hooks/useNow';
import { useAppState } from '../state/AppStateContext';
import { daysUntil } from '../utils/date';

/**
 * Dashboard: mọi con số/biểu đồ đều tính lại từ dữ liệu trong state (đồng bộ LocalStorage),
 * nên thêm/sửa/xóa/hoàn thành task hoặc ghi giờ học là dashboard đổi theo ngay.
 */
export function DashboardPage() {
  const { data } = useAppState();
  const now = useNow(30_000);

  const overview = useMemo(() => computeOverview(data.tasks, now), [data.tasks, now]);
  const weekly = useMemo(() => computeWeeklyStudy(data.sessions, now), [data.sessions, now]);
  const slices = useMemo(() => computeStatusBreakdown(data.tasks), [data.tasks]);
  const today = useMemo(() => selectTodaysTasks(data.tasks, now, 5), [data.tasks, now]);
  const upcoming = useMemo(() => selectUpcomingDeadlines(data.tasks, 5), [data.tasks]);
  const ranked = useMemo(() => rankTasks(data.tasks, now), [data.tasks, now]);
  const remainingThisWeek = useMemo(
    () =>
      data.tasks
        .filter((t) => t.status !== 'completed' && daysUntil(t.deadline, now) <= SOON_DAYS)
        .reduce((sum, t) => sum + Math.max(0, t.estimatedMinutes - t.actualMinutes), 0),
    [data.tasks, now],
  );

  return (
    // Hai cột độc lập: cột phải (việc hôm nay) dài bao nhiêu cũng không kéo dãn cột trái
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:items-start">
      <div className="space-y-4 xl:col-span-8">
        <HeroCard userName={data.userName} now={now} subjectCount={data.subjects.length} overview={overview} todayCount={today.length} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-8">
          <div className="md:col-span-5">
            <WeeklyStudyChart data={weekly} />
          </div>
          <div className="md:col-span-3">
            <TaskCompletionChart slices={slices} rate={overview.completionRate} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <UpcomingDeadlines tasks={upcoming} subjects={data.subjects} now={now} />
          <AiAssistantCard top={ranked[0]} subjects={data.subjects} remainingMinutesThisWeek={remainingThisWeek} />
        </div>
      </div>

      <div className="space-y-4 xl:col-span-4">
        <TodayTasks items={today} now={now} />
        <TodayEvents now={now} />
        <FocusCard />
      </div>
    </div>
  );
}
