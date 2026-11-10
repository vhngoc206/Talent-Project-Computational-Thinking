/** Khung cảnh báo đỏ ở đầu trang khi có nhiệm vụ còn dưới 1 tiếng là tới deadline. */
import { useState } from 'react';
import { AlarmClock, BellRing, Check } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useNow } from '../../hooks/useNow';
import { useAppState } from '../../state/AppStateContext';
import { formatTime } from '../../utils/date';
import { dueSoon, formatMinutesLeft } from './deadlineAlerts';

export function DeadlineBanner() {
  const { data, actions } = useAppState();
  const now = useNow(30_000);
  const soon = dueSoon(data.tasks, now);
  const [perm, setPerm] = useState(() => ('Notification' in window ? Notification.permission : 'denied'));

  if (soon.length === 0) return null;
  return (
    <section className="anim-fade-up mb-4 rounded-2xl border border-danger-fg/20 bg-danger-bg p-4" role="alert" aria-label="Sắp tới deadline">
      <p className="mb-2 flex items-center gap-2 text-sm font-extrabold text-danger-fg">
        <AlarmClock className="h-4 w-4" aria-hidden /> Sắp tới deadline!
      </p>
      <ul className="space-y-1.5">
        {soon.map(({ task, minutesLeft }) => (
          <li key={task.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 font-bold text-ink">{task.title}</span>
            <span className="text-xs font-extrabold text-danger-fg">
              còn {formatMinutesLeft(minutesLeft)} · hạn {formatTime(task.deadline)}
            </span>
            <Button size="sm" icon={<Check className="h-3.5 w-3.5" />} onClick={() => actions.setTaskStatus(task.id, 'completed')}>
              Đã xong
            </Button>
          </li>
        ))}
      </ul>
      {perm === 'default' && (
        <button
          type="button"
          onClick={() => void Notification.requestPermission().then(setPerm)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-extrabold text-danger-fg hover:underline"
        >
          <BellRing className="h-3.5 w-3.5" aria-hidden /> Bật thông báo trên máy để được nhắc cả khi đang ở tab khác
        </button>
      )}
    </section>
  );
}
