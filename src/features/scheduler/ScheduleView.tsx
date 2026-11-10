import { useState } from 'react';
import { CalendarDays, CalendarPlus, Check, Clock, Pin, Play } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useToast } from '../../components/ui/Toast';
import { useAppState } from '../../state/AppStateContext';
import { WEEKDAY_LONG } from '../../constants';
import type { StudySchedule, StudySession, Subject, Task } from '../../types';
import { cn } from '../../utils/cn';
import { formatMinutes, toDateKey } from '../../utils/date';
import { SessionTimeModal } from './SessionTimeModal';

interface Props {
  schedule: StudySchedule;
  tasks: Task[];
  subjects: Subject[];
  now: Date;
  onToggle: (sessionId: string, completed: boolean) => void;
  onStudyNow: (taskId: string) => void;
}

function dayLabel(dateKey: string, todayKey: string, tomorrowKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  const base = `${WEEKDAY_LONG[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (dateKey === todayKey) return `Hôm nay · ${base}`;
  if (dateKey === tomorrowKey) return `Ngày mai · ${base}`;
  return base;
}

/** Lịch học theo ngày – kết quả của Greedy Scheduler. */
export function ScheduleView({ schedule, tasks, subjects, now, onToggle, onStudyNow }: Props) {
  const { actions } = useAppState();
  const toast = useToast();
  // Phiên đang chọn giờ: null = đóng, 'new' = thêm phiên mới
  const [editing, setEditing] = useState<StudySession | 'new' | null>(null);
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const todayKey = toDateKey(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = toDateKey(tomorrow);
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const byDay = new Map<string, StudySession[]>();
  for (const s of schedule.sessions) byDay.set(s.date, [...(byDay.get(s.date) ?? []), s]);

  const modal = editing && (
    <SessionTimeModal
      session={editing === 'new' ? null : editing}
      tasks={tasks}
      onSave={(input) => {
        const err = actions.setPinnedSession(input);
        if (!err) toast('Đã lưu giờ bạn chọn – lịch đã xếp lại phần còn lại.');
        return err;
      }}
      onRemove={
        editing !== 'new' && editing.pinned
          ? () => {
              actions.removePinnedSession(editing.id);
              setEditing(null);
              toast('Đã bỏ phiên – lịch tự động sẽ xếp lại.', 'info');
            }
          : undefined
      }
      onClose={() => setEditing(null)}
    />
  );

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-ink-mute">Bấm <Clock className="inline h-3 w-3" aria-hidden /> để tự chọn giờ cho một phiên.</p>
      <Button size="sm" icon={<CalendarPlus className="h-3.5 w-3.5" />} onClick={() => setEditing('new')} disabled={!tasks.some((t) => t.status !== 'completed')}>
        Thêm phiên học
      </Button>
    </div>
  );

  if (schedule.sessions.length === 0) {
    return (
      <div className="space-y-3">
        {toolbar}
        <Card>
          <p className="rounded-2xl bg-cream/70 p-5 text-center text-sm text-ink-soft">
            Không có phiên học nào được xếp. Xem cảnh báo phía trên, thêm khung giờ rảnh hoặc kiểm tra deadline của nhiệm vụ.
          </p>
        </Card>
        {modal}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {toolbar}
      {[...byDay.entries()].map(([date, list]) => {
        const total = list.reduce((s, x) => s + x.minutes, 0);
        const done = list.filter((s) => s.completed).reduce((s, x) => s + x.minutes, 0);
        const isPastDay = date < todayKey;
        return (
          <Card key={date} className={cn('p-4', isPastDay && 'opacity-80')}>
            <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-extrabold">
                <CalendarDays className="h-4 w-4 text-brand-deep" aria-hidden />
                {dayLabel(date, todayKey, tomorrowKey)}
              </h3>
              <span className="text-xs font-bold text-ink-soft tabular-nums">
                {list.length} phiên · {formatMinutes(total)}
                {done > 0 && ` · đã học ${formatMinutes(done)}`}
              </span>
            </header>

            <ul className="space-y-2">
              {list.map((s) => {
                const task = taskById.get(s.taskId);
                const subject = subjectById.get(s.subjectId);
                const taskDone = task?.status === 'completed';
                const isPast = date < todayKey || (date === todayKey && (s.endTime ?? '') <= nowHHMM);
                const isNow = date === todayKey && (s.startTime ?? '') <= nowHHMM && nowHHMM < (s.endTime ?? '');
                const canStudyNow = !s.completed && !taskDone && date === todayKey && !isPast;

                return (
                  <li
                    key={s.id}
                    className={cn(
                      'flex flex-wrap items-center gap-3 rounded-2xl border px-3 py-2.5 sm:flex-nowrap',
                      s.completed ? 'border-safe-bg bg-safe-bg/50' : isNow ? 'border-brand bg-brand-tint/60' : 'border-line bg-white',
                    )}
                  >
                    <div className="w-[92px] shrink-0 text-sm font-black tabular-nums">
                      {s.startTime}–{s.endTime}
                    </div>
                    <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: subject?.color ?? '#ccc' }} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate text-sm font-extrabold', (s.completed || taskDone) && 'text-ink-soft line-through decoration-1')}>
                        {task?.title ?? 'Nhiệm vụ đã bị xóa'}
                      </p>
                      <p className="text-xs text-ink-mute">
                        {subject?.code} · {subject?.name} · {s.minutes} phút
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {s.pinned && !s.completed && (
                        <Badge tone="info" className="gap-1">
                          <Pin className="h-3 w-3" aria-hidden /> Giờ bạn chọn
                        </Badge>
                      )}
                      {isNow && !s.completed && <Badge tone="brand">Đang diễn ra</Badge>}
                      {isPast && !s.completed && !taskDone && <Badge tone="warn">Đã lỡ</Badge>}
                      {taskDone && !s.completed && <Badge tone="safe">Task đã xong</Badge>}
                      {canStudyNow && (
                        <button
                          type="button"
                          onClick={() => onStudyNow(s.taskId)}
                          className="inline-flex items-center gap-1 rounded-lg bg-brand-tint px-2 py-1 text-xs font-extrabold text-brand-deep hover:bg-peach"
                          title="Chọn nhiệm vụ này trong Pomodoro"
                        >
                          <Play className="h-3.5 w-3.5" /> Học ngay
                        </button>
                      )}
                      {!s.completed && !taskDone && task && (
                        <button
                          type="button"
                          onClick={() => setEditing(s)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-mute hover:bg-black/5 hover:text-ink"
                          aria-label={`Chọn giờ khác cho phiên ${s.startTime}–${s.endTime}`}
                          title="Tự chọn giờ cho phiên này"
                        >
                          <Clock className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={s.completed}
                        aria-label={s.completed ? 'Bỏ đánh dấu đã học' : 'Đánh dấu đã học phiên này'}
                        title={s.completed ? 'Bỏ đánh dấu (trừ lại giờ học)' : 'Đánh dấu đã học (cộng giờ học vào nhiệm vụ)'}
                        disabled={!task || (taskDone && !s.completed)}
                        onClick={() => onToggle(s.id, !s.completed)}
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-lg border-2 transition-colors disabled:opacity-40',
                          s.completed ? 'border-safe-fg bg-safe-fg text-white' : 'border-line-strong bg-white hover:border-brand',
                        )}
                      >
                        {s.completed && <Check className="h-4 w-4" strokeWidth={3} />}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
      {modal}
    </div>
  );
}
