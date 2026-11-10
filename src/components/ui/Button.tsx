import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

const VARIANT: Record<Variant, string> = {
  // Chữ tối trên nền cam để đạt độ tương phản tốt
  primary: 'bg-brand text-ink hover:bg-brand-hover shadow-sm',
  secondary: 'bg-white text-ink border border-line hover:bg-cream hover:border-line-strong',
  ghost: 'bg-transparent text-ink-soft hover:bg-black/5 hover:text-ink',
  danger: 'bg-danger-fg text-white hover:bg-[#962019]',
};

const SIZE: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-10 gap-2 px-4 text-sm',
};

export function Button({ variant = 'secondary', size = 'md', icon, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-bold transition-colors disabled:opacity-50',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

/** Nút chỉ có icon – luôn kèm aria-label. */
export function IconButton({
  label,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-brand-tint hover:text-ink',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
