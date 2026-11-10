import { useMemo } from 'react';
import { AlarmClockOff, CheckCircle2, Clock, History, ListTodo, Percent, Sigma } from 'lucide-react';
import type { ReactNode } from 'react';
import { ProgressBar } from '../components/ui/Badge';
import { Card, CardHeader } from '../components/ui/Card';
import {
  computeOverview,
  computeStatusBreakdown,
  computeStudyBySubject,
  computeSubjectProgress,
  computeWeeklyPerformance,
  computeWeeklyStudy,
} from '../features/analytics/stats';
import { SubjectDistributionChart } from '../features/analytics/SubjectDistributionChart';
import { TaskCompletionChart } from '../features/analytics/TaskCompletionChart';
import { WeeklyPerformanceChart } from '../features/analytics/WeeklyPerformanceChart';
import { WeeklyStudyChart } from '../features/analytics/WeeklyStudyChart';
import { useNow } from '../hooks/useNow';
import { useAppState } from '../state/AppStateContext';
import type { SessionOrigin } from '../types';
import { formatMinutes } from '../utils/date';
import { cn } from '../utils/cn';

const ORIGIN_LABEL: Record<SessionOrigin, string> = { pomodoro: 'Pomodoro', scheduler: 'Theo lịch', manual: 'Ghi tay' };

function StatTile({ icon, label, value, tone = 'bg-white' }: { icon: ReactNode; label: string; value: string; tone?: string }) {
  return (
    <div className={cn('rounded-2xl p-4 shadow-soft', tone)}>
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-white/80 text-brand-deep">{icon}</div>
      <p className="text-2xl font-black leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-bold text-ink-soft">{label}</p>
    </div>
  );
}

/** Trang Thống kê – mọi số liệu tính từ dữ liệu thật trong LocalStorage. */
export function AnalyticsPage() {
  const { data } = useAppState();
  const now = useNow(60_000);

  const overview = useMemo(() => computeOverview(data.tasks, now), [data.tasks, now]);
  const weekly = useMemo(() => computeWeeklyStudy(data.sessions, now), [data.sessions, now]);
  const performance = useMemo(() => computeWeeklyPerformance(data.tasks, data.sessions, now, 6), [data.tasks, data.sessions, now]);
  const slices = useMemo(() => computeStatusBreakdown(data.tasks), [data.tasks]);
  const bySubject = useMemo(() => computeStudyBySubject(data.tasks, data.subjects), [data.tasks, data.subjects]);
  const progress = useMemo(() => computeSubjectProgress(data.tasks, data.subjects), [data.tasks, data.subjects]);

  const taskById = new Map(data.tasks.map((t) => [t.id, t]));
  const subjectById = new Map(data.subjects.map((s) => [s.id, s]));
  const recent = [...data.sessions].filter((s) => s.completed).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile icon={<Sigma className="h-4 w-4" />} label="Tổng nhiệm vụ" value={String(overview.totalTasks)} />
        <StatTile icon={<CheckCircle2 className="h-4 w-4" />} label="Đã hoàn thành" value={String(overview.completedTasks)} tone="bg-safe-bg" />
        <StatTile icon={<ListTodo className="h-4 w-4" />} label="Chưa hoàn thành" value={String(overview.pendingTasks)} tone="bg-butter" />
        <StatTile icon={<AlarmClockOff className="h-4 w-4" />} label="Quá hạn" value={String(overview.overdueTasks)} tone="bg-danger-bg" />
        <StatTile icon={<Percent className="h-4 w-4" />} label="Completion rate" value={`${overview.completionRate}%`} tone="bg-blush" />
        <StatTile icon={<Clock className="h-4 w-4" />} label="Tổng thời gian học" value={formatMinutes(overview.totalStudyMinutes)} tone="bg-peach" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <WeeklyPerformanceChart data={performance} />
        </div>
        <div className="xl:col-span-5">
          <WeeklyStudyChart data={weekly} />
        </div>
        <div className="xl:col-span-4">
          <TaskCompletionChart slices={slices} rate={overview.completionRate} />
        </div>
        <div className="xl:col-span-8">
          <SubjectDistributionChart data={bySubject} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader icon={<Sigma className="h-4 w-4" aria-hidden />} title="Tiến độ theo môn" subtitle="Giờ đã học so với giờ ước tính" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-left text-sm">
              <thead>
                <tr className="text-xs text-ink-mute">
                  <th className="pb-2 font-bold">Môn</th>
                  <th className="pb-2 text-center font-bold">Nhiệm vụ</th>
                  <th className="pb-2 font-bold">Giờ học</th>
                </tr>
              </thead>
              <tbody>
                {progress.map((p) => {
                  const pct = p.estimatedMinutes ? Math.round((Math.min(p.actualMinutes, p.estimatedMinutes) / p.estimatedMinutes) * 100) : 0;
                  return (
                    <tr key={p.subject.id} className="border-t border-line">
                      <td className="py-2.5 pr-3">
                        <span className="flex items-center gap-2 font-bold">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.subject.color }} aria-hidden />
                          {p.subject.code}
                          <span className="hidden truncate font-semibold text-ink-mute md:inline">{p.subject.name}</span>
                        </span>
                      </td>
                      <td className="py-2.5 text-center tabular-nums">
                        {p.completedTasks}/{p.totalTasks}
                      </td>
                      <td className="w-[45%] py-2.5">
                        <div className="mb-1 flex justify-between text-xs tabular-nums text-ink-soft">
                          <span>
                            {formatMinutes(p.actualMinutes)} / {formatMinutes(p.estimatedMinutes)}
                          </span>
                          <span>{pct}%</span>
                        </div>
                        <ProgressBar value={pct} label={`Tiến độ ${p.subject.name}`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader icon={<History className="h-4 w-4" aria-hidden />} title="Phiên học gần đây" subtitle="Từ Pomodoro, lịch học hoặc ghi tay" />
          {recent.length === 0 ? (
            <p className="rounded-2xl bg-cream/70 p-4 text-sm text-ink-soft">Chưa có phiên học nào.</p>
          ) : (
            <ul className="space-y-2">
              {recent.map((s) => {
                const t = taskById.get(s.taskId);
                const sub = subjectById.get(s.subjectId);
                return (
                  <li key={s.id} className="flex items-center gap-3 rounded-2xl bg-cream/60 px-3 py-2">
                    <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: sub?.color }} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{t?.title}</p>
                      <p className="text-xs text-ink-mute">
                        {s.date.split('-').reverse().join('/')} · {ORIGIN_LABEL[s.origin]}
                      </p>
                    </div>
                    <span className="text-sm font-black tabular-nums">{formatMinutes(s.minutes)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
