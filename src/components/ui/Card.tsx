import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn('rounded-2xl bg-white p-5 shadow-soft', className)} {...rest}>
      {children}
    </section>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function CardHeader({ title, subtitle, action, icon }: CardHeaderProps) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3 [&>a]:shrink-0 [&>a]:whitespace-nowrap">
      <div className="flex items-start gap-2.5">
        {icon && <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand-deep">{icon}</span>}
        <div>
          <h2 className="text-base font-extrabold leading-tight text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink-mute">{subtitle}</p>}
        </div>
      </div>
      {action}
    </header>
  );
}
