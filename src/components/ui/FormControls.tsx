import { useId, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

/** Nhãn + ô nhập + thông báo lỗi. `children` là hàm nhận id để gắn htmlFor đúng. */
export function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: (props: { id: string; invalid: boolean; describedBy?: string }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-xs font-extrabold text-ink-soft">
        {label}
      </label>
      {children({ id, invalid: Boolean(error), describedBy: error || hint ? msgId : undefined })}
      {error ? (
        <p id={msgId} className="mt-1 text-xs font-semibold text-danger-fg">
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className="mt-1 text-xs text-ink-mute">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface SegmentedProps<T extends string | number> {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  className?: string;
}

/** Nhóm nút chọn một giá trị (Dễ/Trung bình/Khó…). */
export function Segmented<T extends string | number>({ label, value, options, onChange, className }: SegmentedProps<T>) {
  const labelId = useId();
  return (
    <div className={className}>
      <span className="mb-1 block text-xs font-extrabold text-ink-soft" id={labelId}>
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="flex rounded-xl bg-cream p-1">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={cn(
                'flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition-colors',
                active ? 'bg-white text-ink shadow-sm ring-1 ring-brand/60' : 'text-ink-soft hover:text-ink',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
