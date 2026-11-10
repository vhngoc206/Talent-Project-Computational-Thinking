import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { getDeadlineUrgency } from '../../algorithms/priorityScheduler';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import type { Task } from '../../types';
import { daysUntil, formatCountdown } from '../../utils/date';

const TONE: Record<ReturnType<typeof getDeadlineUrgency>, BadgeTone> = {
  danger: 'danger', // đỏ: quá hạn hoặc sắp đến hạn (< 3 ngày)
  warning: 'warn', // cam: gần đến hạn (3–7 ngày)
  safe: 'safe', // xanh: còn nhiều thời gian
  done: 'neutral',
};

/** Badge deadline: màu + icon + chữ (không chỉ dựa vào màu). */
export function DeadlineBadge({ task, now }: { task: Pick<Task, 'deadline' | 'status'>; now: Date }) {
  const urgency = getDeadlineUrgency(task, now);
  const daysLeft = daysUntil(task.deadline, now);

  if (urgency === 'done') return <Badge tone="neutral" icon={<CheckCircle2 className="h-3 w-3" aria-hidden />}>Hoàn thành</Badge>;

  const Icon = urgency === 'danger' ? AlertTriangle : Clock;
  return (
    <Badge tone={TONE[urgency]} icon={<Icon className="h-3 w-3" aria-hidden />}>
      {formatCountdown(daysLeft)}
    </Badge>
  );
}
