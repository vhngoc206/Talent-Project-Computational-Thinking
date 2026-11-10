import { BookOpen, CalendarClock, ListTodo, TrendingUp, type LucideIcon } from 'lucide-react';
import { ProgressBar } from '../../components/ui/Badge';
import { ghibliThumb } from '../../constants/ghibli';
import { routeHref } from '../../hooks/useHashRoute';
import { greetingForHour } from '../../utils/date';
import type { Overview } from '../analytics/stats';

interface Props {
  userName: string;
  now: Date;
  subjectCount: number;
  overview: Overview;
  /** Số nhiệm vụ cần làm hôm nay (đến hạn / quá hạn / đang làm) */
  todayCount: number;
}

function Stat({ icon: Icon, value, label, href }: { icon: LucideIcon; value: string | number; label: string; href: string }) {
  return (
    <a href={href} className="group rounded-xl bg-cream p-3.5 transition-colors hover:bg-brand-tint">
      <Icon className="mb-1.5 h-4 w-4 text-brand-deep" aria-hidden />
      <p className="text-2xl font-black leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-bold text-ink-soft">{label}</p>
    </a>
  );
}

export function HeroCard({ userName, now, subjectCount, overview, todayCount }: Props) {
  const greeting = greetingForHour(now.getHours());
  const summary =
    overview.totalTasks === 0
      ? subjectCount === 0
        ? 'Bắt đầu bằng cách thêm môn học, rồi thêm nhiệm vụ đầu tiên của bạn nhé.'
        : 'Thêm nhiệm vụ đầu tiên để ứng dụng giúp bạn lên kế hoạch.'
      : overview.pendingTasks === 0
      ?'Bạn đã hoàn thành mọi nhiệm vụ. Hãy thêm bài mới hoặc nghỉ ngơi thật tốt nhé!'
      : `Hôm nay có ${todayCount} nhiệm vụ cần chú ý, và ${overview.upcomingDeadlines} deadline trong 7 ngày tới.`;

  return (
    <section aria-label="Lời chào" className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-soft">
      {/* Mei ngủ trên bụng Totoro – ảnh chính thức của Studio Ghibli */}
      <img
        src={ghibliThumb('totoro024')}
        alt="Mei ngủ trên bụng Totoro"
        className="anim-bob pointer-events-none absolute right-5 top-5 hidden h-28 w-44 rounded-xl object-cover shadow-soft sm:block"
        style={{ objectPosition: '40% 40%' }}
      />

      <div className="relative max-w-md sm:pr-40 lg:pr-0">
        <h2 className="font-serif text-2xl font-bold leading-tight sm:text-3xl">
          {greeting}, {userName}!
        </h2>
        <p className="mt-1.5 text-sm font-semibold text-ink-soft">{summary}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={routeHref('tasks')}
            className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-extrabold text-ink transition-colors hover:bg-brand-hover"
          >
            Xem việc ưu tiên
          </a>
          <a
            href={routeHref('focus')}
            className="inline-flex h-9 items-center rounded-lg border border-line px-4 text-sm font-extrabold text-ink transition-colors hover:bg-cream"
          >
            ⏳ Vào Focus
          </a>
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={BookOpen} value={subjectCount} label="Môn học" href={routeHref('subjects')} />
        <Stat icon={ListTodo} value={overview.pendingTasks} label="Nhiệm vụ chưa xong" href={routeHref('tasks')} />
        <Stat icon={CalendarClock} value={overview.upcomingDeadlines} label="Deadline sắp tới (7 ngày)" href={routeHref('tasks')} />
        <div className="rounded-xl bg-cream p-3.5">
          <TrendingUp className="mb-1.5 h-4 w-4 text-brand-deep" aria-hidden />
          <p className="text-2xl font-black leading-none tabular-nums">{overview.progressPercent}%</p>
          <p className="mb-2 mt-1 text-xs font-bold text-ink-soft" title="Tính theo thời gian đã học so với thời gian dự kiến của mọi nhiệm vụ">
            Tiến độ học tập
          </p>
          <ProgressBar value={overview.progressPercent} label="Tiến độ học tập tổng quan" />
        </div>
      </div>
    </section>
  );
}
