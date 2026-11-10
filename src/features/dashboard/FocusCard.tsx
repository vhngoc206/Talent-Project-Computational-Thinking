import { Hourglass } from 'lucide-react';
import { ghibliThumb } from '../../constants/ghibli';
import { routeHref } from '../../hooks/useHashRoute';
import { usePomodoro } from '../pomodoro/PomodoroContext';
import { formatClock, PHASE_LABEL } from '../pomodoro/pomodoroLogic';

/** Lối vào trang Focus (Pomodoro toàn màn hình) – hiện đồng hồ nếu đang chạy. */
export function FocusCard() {
  const p = usePomodoro();
  const running = p.status !== 'idle';
  return (
    <a href={routeHref('focus')} className="group relative block overflow-hidden rounded-2xl shadow-soft" aria-label="Mở trang Focus">
      <img src={ghibliThumb('totoro029')} alt="" className="h-36 w-full object-cover transition-transform duration-700 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold text-white/85">
            <Hourglass className="h-3.5 w-3.5" aria-hidden /> Focus · Pomodoro
          </p>
          <p className="text-2xl font-black tabular-nums leading-tight">{running ? formatClock(p.remainingSeconds) : `${p.settings.minutes.focus} phút`}</p>
          <p className="text-xs font-semibold text-white/85">{running ? `${PHASE_LABEL[p.phase]}${p.activeTask ? ` · ${p.activeTask.title}` : ''}` : 'Nhạc, mưa rơi và đồng hồ toàn màn hình'}</p>
        </div>
        <span className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-extrabold text-ink">{running ? 'Mở' : 'Bắt đầu'}</span>
      </div>
    </a>
  );
}
