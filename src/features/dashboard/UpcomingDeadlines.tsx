import { CalendarClock, CheckCheck } from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { routeHref } from '../../hooks/useHashRoute';
import type { Subject, Task } from '../../types';
import { formatDeadline } from '../../utils/date';
import { DeadlineBadge } from '../tasks/DeadlineBadge';

export function UpcomingDeadlines({ tasks, subjects, now }: { tasks: Task[]; subjects: Subject[]; now: Date }) {
  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  return (
    <Card className="h-full">
      <CardHeader
        icon={<CalendarClock className="h-4 w-4" aria-hidden />}
        title="Deadline sắp tới"
        subtitle="Đỏ: dưới 3 ngày · Cam: 3–7 ngày · Xanh: còn lâu"
        action={
          <a href={routeHref('tasks')} className="text-xs font-extrabold text-brand-deep hover:underline">
            Xem tất cả
          </a>
        }
      />
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-cream/70 px-4 py-8 text-center">
          <CheckCheck className="h-6 w-6 text-brand-deep" aria-hidden />
          <p className="text-sm font-extrabold">Không còn deadline nào</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => {
            const s = subjectById.get(t.subjectId);
            return (
              <li key={t.id} className="flex items-center gap-3 rounded-2xl bg-cream/60 py-2 pl-2 pr-3">
                <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: s?.color ?? '#ccc' }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-extrabold leading-snug" title={t.title}>
                    {t.title}
                  </p>
                  <p className="truncate text-xs text-ink-mute">
                    {s?.code} · {formatDeadline(t.deadline)}
                  </p>
                </div>
                <span className="shrink-0"><DeadlineBadge task={t} now={now} /></span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
