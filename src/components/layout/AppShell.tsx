import { useEffect, useState, type ReactNode } from 'react';
import { ghibliImage, ghibliSrc } from '../../constants/ghibli';
import type { RouteId } from '../../hooks/useHashRoute';
import { LegacyImportBanner } from '../../features/auth/LegacyImportBanner';
import { DeadlineBanner } from '../../features/tasks/DeadlineBanner';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface PageMeta {
  title: string;
  /** Biểu tượng trang kiểu Notion */
  icon: string;
  /** Ảnh bìa (id trong GHIBLI_IMAGES) */
  cover: string;
}

export const PAGE_META: Record<RouteId, PageMeta> = {
  dashboard: { title: 'Tổng quan', icon: '🏡', cover: 'totoro001' },
  subjects: { title: 'Môn học', icon: '📚', cover: 'totoro026' },
  tasks: { title: 'Nhiệm vụ', icon: '✅', cover: 'totoro012' },
  calendar: { title: 'Lịch', icon: '📅', cover: 'totoro011' },
  scheduler: { title: 'Lịch học thông minh', icon: '🌾', cover: 'totoro041' },
  focus: { title: 'Focus', icon: '⏳', cover: 'totoro029' },
  ai: { title: 'AI Study Assistant', icon: '🍃', cover: 'totoro019' },
  analytics: { title: 'Thống kê học tập', icon: '📊', cover: 'totoro038' },
  admin: { title: 'Quản trị', icon: '🛡️', cover: 'totoro044' },
};

/** Vài chiếc lá rơi nhẹ trên ảnh bìa (thuần CSS) */
const LEAVES = [
  { left: '12%', delay: '0s', duration: '11s' },
  { left: '38%', delay: '4s', duration: '13s' },
  { left: '64%', delay: '2s', duration: '10s' },
  { left: '86%', delay: '7s', duration: '14s' },
];

function PageCover({ route }: { route: RouteId }) {
  const meta = PAGE_META[route];
  const img = ghibliImage(meta.cover);
  return (
    // Ảnh phủ kín khung; phần bị cắt (trên/dưới) được chọn theo điểm lấy nét của từng ảnh để giữ nhân vật chính
    <div className="relative h-48 w-full overflow-hidden bg-blush sm:h-64 lg:h-80">
      <img src={ghibliSrc(img.id)} alt={img.label} className="h-full w-full object-cover" style={{ objectPosition: img.focus }} />
      {LEAVES.map((l) => (
        <span key={l.left} className="leaf" style={{ left: l.left, animationDelay: l.delay, animationDuration: l.duration }} aria-hidden />
      ))}
    </div>
  );
}

export function AppShell({ route, children }: { route: RouteId; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const meta = PAGE_META[route];

  // Đổi trang thì đóng menu trên điện thoại
  useEffect(() => setMenuOpen(false), [route]);

  return (
    <div className="flex min-h-screen">
      <Sidebar route={route} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar route={route} title={meta.title} icon={meta.icon} onOpenMenu={() => setMenuOpen(true)} />
        <PageCover route={route} />
        <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-8 lg:px-12">
          <div className="relative z-10 -mt-9 mb-6 sm:-mt-11">
            <span className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-paper text-5xl leading-none shadow-soft sm:h-20 sm:w-20 sm:text-6xl" aria-hidden>
              {meta.icon}
            </span>
            <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-ink sm:text-4xl">{meta.title}</h1>
          </div>
          <DeadlineBanner />
          <LegacyImportBanner />
          <main className="anim-fade-up" key={route}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
