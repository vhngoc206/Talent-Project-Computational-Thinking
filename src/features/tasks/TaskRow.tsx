import { useState } from 'react';
import { Check, ChevronDown, Pencil, Trash2 } from 'lucide-react';
import type { PriorityResult } from '../../algorithms/priorityScheduler';
import { Badge } from '../../components/ui/Badge';
import { IconButton } from '../../components/ui/Button';
import { Segmented } from '../../components/ui/FormControls';
import { DIFFICULTY_LABEL, IMPORTANCE_LABEL, STATUS_LABEL, STATUS_OPTIONS } from '../../constants';
import type { Subject, Task, TaskStatus } from '../../types';
import { cn } from '../../utils/cn';
import { formatDeadline, formatMinutes } from '../../utils/date';
import { DeadlineBadge } from './DeadlineBadge';
import { LEVEL_TONE, PriorityBreakdown } from './PriorityBreakdown';

interface Props {
  task: Task;
  subject: Subject | undefined;
  /** Kết quả Priority Engine (undefined nếu task đã hoàn thành) */
  priority: PriorityResult | undefined;
  /** Thứ hạng trong danh sách ưu tiên (1 = ưu tiên nhất) */
  rank: number | undefined;
  now: Date;
  onSetStatus: (status: TaskStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function TaskRow({ task, subject, priority, rank, now, onSetStatus, onEdit, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const done = task.status === 'completed';
  const progress = Math.min(100, Math.round((task.actualMinutes / task.estimatedMinutes) * 100));

  return (
    <li className="rounded-2xl border border-line bg-white transition-shadow hover:shadow-soft">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <button
          role="checkbox"
          aria-checked={done}
          aria-label={done ? `Mở lại "${task.title}"` : `Đánh dấu hoàn thành "${task.title}"`}
          onClick={() => onSetStatus(done ? (task.actualMinutes > 0 ? 'in_progress' : 'todo') : 'completed')}
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-colors',
            done ? 'border-chart-done bg-chart-done text-white' : 'border-line-strong hover:border-brand',
          )}
        >
          {done && <Check className="h-4 w-4" aria-hidden />}
        </button>

        <div className="min-w-0 flex-1 basis-48">
          <p className={cn('truncate text-sm font-extrabold', done && 'text-ink-mute line-through')} title={task.title}>
            {task.title}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-mute">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subject?.color ?? '#ccc' }} aria-hidden />
            <span className="truncate">{subject ? `${subject.code} · ${subject.name}` : 'Môn học đã bị xóa'}</span>
            {task.status === 'in_progress' && <span className="shrink-0 font-extrabold text-brand-deep">· Đang làm</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden text-xs font-semibold text-ink-soft md:inline">{formatDeadline(task.deadline)}</span>
          <DeadlineBadge task={task} now={now} />
          {priority && rank !== undefined ? (
            <Badge tone={LEVEL_TONE[priority.level]} className="tabular-nums" >
              #{rank} · {priority.score.toFixed(2)}
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center">
          <IconButton label="Sửa nhiệm vụ" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </IconButton>
          <IconButton label="Xóa nhiệm vụ" onClick={onDelete} className="hover:text-danger-fg">
            <Trash2 className="h-4 w-4" />
          </IconButton>
          <IconButton label={open ? 'Thu gọn chi tiết' : 'Xem chi tiết'} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
          </IconButton>
        </div>
      </div>

      {open && (
        <div className="grid gap-4 border-t border-line px-4 py-4 lg:grid-cols-2">
          <div className="space-y-3">
            {task.description && <p className="text-sm text-ink-soft">{task.description}</p>}
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-cream/70 p-2.5">
                <dt className="text-ink-mute">Deadline</dt>
                <dd className="font-extrabold">{formatDeadline(task.deadline)}</dd>
              </div>
              <div className="rounded-xl bg-cream/70 p-2.5">
                <dt className="text-ink-mute">Độ khó · Quan trọng</dt>
                <dd className="font-extrabold">
                  {DIFFICULTY_LABEL[task.difficulty]} · {IMPORTANCE_LABEL[task.importance]}
                </dd>
              </div>
              <div className="col-span-2 rounded-xl bg-cream/70 p-2.5">
                <dt className="text-ink-mute">
                  Đã học {formatMinutes(task.actualMinutes)} / dự kiến {formatMinutes(task.estimatedMinutes)}
                </dt>
                <dd className="mt-1.5 h-2 overflow-hidden rounded-full bg-white" aria-hidden>
                  <div className="h-full rounded-full bg-brand" style={{ width: `${progress}%` }} />
                </dd>
              </div>
            </dl>
            <Segmented label="Trạng thái" value={task.status} onChange={onSetStatus} options={STATUS_OPTIONS.map((v) => ({ value: v, label: STATUS_LABEL[v] }))} />
          </div>

          {priority ? (
            <PriorityBreakdown result={priority} />
          ) : (
            <p className="self-center rounded-2xl bg-cream/70 p-4 text-sm text-ink-soft">Nhiệm vụ đã hoàn thành nên không còn nằm trong danh sách ưu tiên.</p>
          )}
        </div>
      )}
    </li>
  );
}
