import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export type BadgeTone = 'neutral' | 'brand' | 'danger' | 'warn' | 'safe' | 'info';

const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-cream text-ink-soft',
  brand: 'bg-brand-tint text-brand-deep',
  danger: 'bg-danger-bg text-danger-fg',
  warn: 'bg-warn-bg text-warn-fg',
  safe: 'bg-safe-bg text-safe-fg',
  info: 'bg-sky text-sky-deep',
};

export function Badge({ tone = 'neutral', icon, children, className }: { tone?: BadgeTone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold', TONE[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

export function ProgressBar({ value, className, label }: { value: number; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn('h-2.5 w-full overflow-hidden rounded-full bg-brand-tint', className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong bg-cream/60 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-tint text-brand-deep">{icon}</div>
      <p className="text-sm font-extrabold">{title}</p>
      {text && <p className="max-w-sm text-xs text-ink-mute">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
