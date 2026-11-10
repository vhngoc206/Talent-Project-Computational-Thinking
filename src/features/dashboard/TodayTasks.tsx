import { useState, type FormEvent } from 'react';
import { Check, PartyPopper, Plus } from 'lucide-react';
import type { PriorityResult } from '../../algorithms/priorityScheduler';
import { Card, CardHeader } from '../../components/ui/Card';
import { useToast } from '../../components/ui/Toast';
import { useAppState } from '../../state/AppStateContext';
import { cn } from '../../utils/cn';
import { atTime, formatTime, isoToLocalInput, localInputToIso, toDateKey } from '../../utils/date';
import { validateTask } from '../../utils/validation';
import { DeadlineBadge } from '../tasks/DeadlineBadge';
import { ListChecks } from 'lucide-react';
import { routeHref } from '../../hooks/useHashRoute';

export function TodayTasks({ items, now }: { items: PriorityResult[]; now: Date }) {
  const { data, actions } = useAppState();
  const toast = useToast();
  const subjectById = new Map(data.subjects.map((s) => [s.id, s]));
  const taskById = new Map(data.tasks.map((t) => [t.id, t]));
  const todayKey = toDateKey(now);
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const todaySessions = (data.schedule?.sessions ?? [])
    .filter((s) => s.date === todayKey && s.startTime)
    .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));

  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [error, setError] = useState('');
  const effectiveSubject = subjectId || data.subjects[0]?.id || '';

  /** Thêm nhanh: deadline mặc định là 23:59 hôm nay, mức vừa – có thể chỉnh lại ở trang Nhiệm vụ. */
  function handleAdd(e: FormEvent) {
    e.preventDefault();
    const input = {
      title,
      subjectId: effectiveSubject,
      description: '',
      deadline: localInputToIso(isoToLocalInput(atTime(new Date(), 0, 23, 59).toISOString())),
      estimatedMinutes: 60,
      actualMinutes: 0,
      difficulty: 'medium' as const,
      importance: 'medium' as const,
      status: 'todo' as const,
    };
    const result = validateTask(input, data.subjects);
    if (!result.valid) {
      setError(result.errors.title ?? result.errors.subjectId ?? 'Dữ liệu chưa hợp lệ.');
      return;
    }
    actions.addTask(input);
    setTitle('');
    setError('');
    toast('Đã thêm nhiệm vụ cho hôm nay (hạn 23:59, 1 giờ).');
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        icon={<ListChecks className="h-4 w-4" aria-hidden />}
        title="Việc cần làm hôm nay"
        subtitle="Theo lịch học của bạn và các deadline gần"
        action={
          <a href={routeHref('tasks')} className="text-xs font-extrabold text-brand-deep hover:underline">
            Xem tất cả
          </a>
        }
      />

      {/* Phiên học hôm nay – lấy từ Lịch học thông minh */}
      <section aria-label="Lịch học hôm nay" className="mb-3">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">Lịch học hôm nay</p>
          <a href={routeHref('scheduler')} className="text-[11px] font-extrabold text-brand-deep hover:underline">
            Sửa lịch
          </a>
        </div>
        {todaySessions.length === 0 ? (
          <p className="rounded-xl bg-cream/70 px-3 py-2.5 text-xs text-ink-soft">Hôm nay không có phiên học nào trong lịch.</p>
        ) : (
          <ul className="space-y-1.5">
            {todaySessions.map((s) => {
              const task = taskById.get(s.taskId);
              const subject = subjectById.get(s.subjectId);
              const past = (s.endTime ?? '') <= nowHHMM;
              const live = (s.startTime ?? '') <= nowHHMM && nowHHMM < (s.endTime ?? '');
              return (
                <li
                  key={s.id}
                  className={cn('flex items-center gap-2.5 rounded-xl border px-2.5 py-2', s.completed ? 'border-safe-bg bg-safe-bg/50' : live ? 'border-brand bg-brand-tint/60' : 'border-line')}
                >
                  <button
                    role="checkbox"
                    aria-checked={s.completed}
                    aria-label={s.completed ? 'Bỏ đánh dấu đã học' : `Đánh dấu đã học phiên ${s.startTime}–${s.endTime}`}
                    disabled={!task || task.status === 'completed'}
                    onClick={() => {
                      actions.toggleScheduleSession(s.id, !s.completed);
                      toast(s.completed ? 'Đã bỏ đánh dấu phiên học.' : 'Đã ghi nhận phiên học vào tiến độ.', s.completed ? 'info' : 'success');
                    }}
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-colors disabled:opacity-40',
                      s.completed ? 'border-safe-fg bg-safe-fg text-white' : 'border-line-strong hover:border-brand',
                    )}
                  >
                    {s.completed && <Check className="h-4 w-4" strokeWidth={3} aria-hidden />}
                  </button>
                  <span className="w-[78px] shrink-0 text-xs font-black tabular-nums">
                    {s.startTime}–{s.endTime}
                  </span>
                  <span className="h-6 w-1 shrink-0 rounded-full" style={{ backgroundColor: subject?.color }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-sm font-bold', s.completed && 'text-ink-soft line-through')}>{task?.title ?? 'Nhiệm vụ đã bị xóa'}</span>
                    <span className="block text-[11px] text-ink-mute">
                      {subject?.code} · {s.minutes} phút{s.pinned ? ' · giờ bạn chọn' : ''}
                      {live && !s.completed ? ' · đang diễn ra' : past && !s.completed ? ' · sẽ được dời' : ''}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-mute">Deadline cần chú ý</p>
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl bg-cream/70 px-4 py-5 text-center">
          <PartyPopper className="h-5 w-5 text-brand-deep" aria-hidden />
          <p className="text-sm font-extrabold">Không có deadline gấp</p>
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-line">
          {items.map(({ task }) => {
            const subject = subjectById.get(task.subjectId);
            return (
              <li key={task.id} className="flex items-center gap-3 py-2.5">
                <button
                  role="checkbox"
                  aria-checked={false}
                  aria-label={`Đánh dấu hoàn thành "${task.title}"`}
                  onClick={() => {
                    actions.setTaskStatus(task.id, 'completed');
                    toast(`Hoàn thành "${task.title}"!`);
                  }}
                  className="group flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-line-strong transition-colors hover:border-chart-done hover:bg-chart-done"
                >
                  <Check className="h-4 w-4 text-white opacity-0 group-hover:opacity-100" aria-hidden />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-extrabold leading-snug" title={task.title}>
                    {task.title}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-ink-mute">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: subject?.color }} aria-hidden />
                    {subject?.code} · {formatTime(task.deadline)}
                  </p>
                </div>
                <span className="shrink-0"><DeadlineBadge task={task} now={now} /></span>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleAdd} className="mt-3 border-t border-line pt-3" noValidate>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="quick-title">
            Thêm nhanh nhiệm vụ
          </label>
          <input
            id="quick-title"
            className={`input-base min-w-0 flex-1 ${error ? 'input-error' : ''}`}
            placeholder="Thêm nhanh nhiệm vụ hôm nay…"
            value={title}
            maxLength={120}
            onChange={(e) => {
              setTitle(e.target.value);
              setError('');
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'quick-error' : undefined}
          />
          <label className="sr-only" htmlFor="quick-subject">
            Môn học
          </label>
          <select id="quick-subject" className="input-base w-24 shrink-0" value={effectiveSubject} onChange={(e) => setSubjectId(e.target.value)}>
            {data.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
              </option>
            ))}
          </select>
          <button type="submit" aria-label="Thêm nhiệm vụ" className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-brand text-ink hover:bg-brand-hover">
            <Plus className="h-5 w-5" />
          </button>
        </div>
        {error && (
          <p id="quick-error" className="mt-1.5 text-xs font-semibold text-danger-fg">
            {error}
          </p>
        )}
      </form>
    </Card>
  );
}
