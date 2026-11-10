import { BarChart3, BookOpen, CalendarDays, CalendarRange, Hourglass, LayoutDashboard, ListChecks, ShieldCheck, Sparkles, X, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { ghibliThumb } from '../../constants/ghibli';
import { quoteOfDay } from '../../constants/quotes';
import { routeHref, type RouteId } from '../../hooks/useHashRoute';
import { useAppState } from '../../state/AppStateContext';
import { cn } from '../../utils/cn';

interface NavItem {
  id: RouteId;
  label: string;
  icon: LucideIcon;
}

export const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Không gian học',
    items: [
      { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
      { id: 'subjects', label: 'Môn học', icon: BookOpen },
      { id: 'tasks', label: 'Nhiệm vụ', icon: ListChecks },
    ],
  },
  {
    label: 'Thời gian',
    items: [
      { id: 'calendar', label: 'Lịch', icon: CalendarDays },
      { id: 'scheduler', label: 'Lịch học thông minh', icon: CalendarRange },
      { id: 'focus', label: 'Focus · Pomodoro', icon: Hourglass },
    ],
  },
  {
    label: 'Trợ lý',
    items: [
      { id: 'ai', label: 'AI Assistant', icon: Sparkles },
      { id: 'analytics', label: 'Thống kê', icon: BarChart3 },
    ],
  },
];

/** Sidebar kiểu Notion: cố định bên trái trên màn hình lớn, ngăn kéo (drawer) trên điện thoại. */
export function Sidebar({ route, open, onClose }: { route: RouteId; open: boolean; onClose: () => void }) {
  const { storageOk, data } = useAppState();
  const auth = useAuth();
  const groups = auth?.isAdmin
    ? [...NAV_GROUPS, { label: 'Quản trị', items: [{ id: 'admin' as RouteId, label: 'Lượt truy cập', icon: ShieldCheck }] }]
    : NAV_GROUPS;

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-ink/30 lg:hidden" onClick={onClose} aria-hidden />}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-line bg-sidebar transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-60 lg:translate-x-0',
          open ? 'translate-x-0 shadow-pop' : '-translate-x-full',
        )}
        aria-label="Thanh điều hướng"
      >
        <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
          <a href={routeHref('dashboard')} className="flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-black/[0.04]">
            <img
              src={ghibliThumb('totoro024')}
              alt=""
              className="h-8 w-8 shrink-0 rounded-lg object-cover"
              style={{ objectPosition: '45% 35%' }}
            />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-extrabold text-ink">SmartStudy</span>
              <span className="block truncate text-[11px] font-semibold text-ink-mute">Không gian của {data.userName}</span>
            </span>
          </a>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-ink-mute hover:bg-black/5 lg:hidden" aria-label="Đóng menu">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav aria-label="Điều hướng chính" className="flex-1 overflow-y-auto px-2 pb-3">
          {groups.map((group) => (
            <div key={group.label} className="mt-3">
              <p className="px-2.5 pb-1 text-[11px] font-bold uppercase tracking-wide text-ink-mute">{group.label}</p>
              {group.items.map(({ id, label, icon: Icon }) => {
                const active = route === id;
                return (
                  <a
                    key={id}
                    href={routeHref(id)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-semibold transition-colors',
                      active ? 'bg-black/[0.06] text-ink' : 'text-ink-soft hover:bg-black/[0.04] hover:text-ink',
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-brand-deep' : 'text-ink-mute')} aria-hidden />
                    <span className="truncate">{label}</span>
                  </a>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="space-y-2 p-3">
          <figure className="overflow-hidden rounded-xl bg-white shadow-soft">
            <img src={ghibliThumb('totoro019')} alt="Mei theo Totoro nhỏ vào rừng – phim Totoro" className="h-20 w-full object-cover" />
            <figcaption className="px-3 py-2 text-xs font-semibold italic leading-snug text-ink-soft">“{quoteOfDay()}”</figcaption>
          </figure>
          {!storageOk && (
            <p className="rounded-lg bg-danger-bg px-2.5 py-1.5 text-[11px] font-semibold text-danger-fg" role="status">
              Chưa lưu được dữ liệu – kiểm tra kết nối mạng.
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
