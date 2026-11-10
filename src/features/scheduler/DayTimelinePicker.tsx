/** Bảng chọn giờ rảnh trong cả ngày (0h–24h): bấm hoặc kéo qua các ô nửa tiếng. */
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { TimeSlot } from '../../types';
import { cn } from '../../utils/cn';
import { CELLS_PER_DAY, cellsToSlots, cellTime, paintRange, slotsToCells } from './dayTimeline';

const ROWS = [
  { label: 'Đêm', from: 0 },
  { label: 'Sáng', from: 12 },
  { label: 'Chiều', from: 24 },
  { label: 'Tối', from: 36 },
];

const PRESETS: Array<{ label: string; from: number; to: number }> = [
  { label: 'Sáng 7–11h', from: 14, to: 21 },
  { label: 'Chiều 13–17h', from: 26, to: 33 },
  { label: 'Tối 19–22h', from: 38, to: 43 },
  { label: 'Cả ngày', from: 0, to: CELLS_PER_DAY - 1 },
];

interface Props {
  slots: TimeSlot[];
  onChange: (slots: TimeSlot[]) => void;
}

export function DayTimelinePicker({ slots, onChange }: Props) {
  const cells = slotsToCells(slots);
  // Kéo chuột: nhớ ô bắt đầu, giá trị đang tô và trạng thái ô trước khi kéo
  const drag = useRef<{ anchor: number; value: boolean; base: boolean[] } | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const stop = () => (drag.current = null);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, []);

  function start(i: number, e: PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    // Trên màn hình cảm ứng, ô đầu tiên giữ con trỏ – nhả ra để các ô khác nhận sự kiện khi kéo
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    drag.current = { anchor: i, value: !cells[i], base: cells };
    onChange(cellsToSlots(paintRange(cells, i, i, !cells[i])));
  }

  function extend(i: number) {
    setHover(i);
    const d = drag.current;
    if (d) onChange(cellsToSlots(paintRange(d.base, d.anchor, i, d.value)));
  }

  const selectedCount = cells.filter(Boolean).length;
  const allOn = selectedCount === CELLS_PER_DAY;

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => {
          const on = cells.slice(p.from, p.to + 1).every(Boolean) && (p.label !== 'Cả ngày' || allOn);
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange(cellsToSlots(paintRange(cells, p.from, p.to, !on)))}
              className={cn('rounded-full px-2.5 py-1 text-[11px] font-extrabold', on ? 'bg-brand text-ink' : 'bg-cream text-ink-soft hover:bg-brand-tint')}
              aria-pressed={on}
            >
              {p.label}
            </button>
          );
        })}
        {selectedCount > 0 && (
          <button type="button" onClick={() => onChange([])} className="rounded-full px-2.5 py-1 text-[11px] font-extrabold text-ink-mute hover:bg-black/5">
            Xóa hết
          </button>
        )}
      </div>

      <div className="select-none space-y-1.5 rounded-xl bg-cream/70 p-2" onPointerLeave={() => setHover(null)} style={{ touchAction: 'none' }}>
        {ROWS.map((row) => (
          <div key={row.label} className="flex items-end gap-1.5">
            <span className="w-9 shrink-0 pb-1 text-[10px] font-bold text-ink-mute">{row.label}</span>
            <div className="min-w-0 flex-1">
              {/* Nhãn giờ trên mỗi cặp ô */}
              <div className="grid grid-cols-6 text-[9px] font-semibold text-ink-mute">
                {Array.from({ length: 6 }, (_, h) => (
                  <span key={h}>{(row.from / 2 + h) % 24}h</span>
                ))}
              </div>
              <div className="grid grid-cols-12 gap-px">
                {Array.from({ length: 12 }, (_, k) => {
                  const i = row.from + k;
                  return (
                    <button
                      key={i}
                      type="button"
                      onPointerDown={(e) => start(i, e)}
                      onPointerEnter={() => extend(i)}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          onChange(cellsToSlots(paintRange(cells, i, i, !cells[i])));
                        }
                      }}
                      aria-pressed={cells[i]}
                      aria-label={`${cellTime(i)}–${cellTime(i + 1)}`}
                      title={`${cellTime(i)} – ${cellTime(i + 1)}`}
                      className={cn(
                        'h-7 transition-colors first:rounded-l-md last:rounded-r-md',
                        k % 2 === 0 ? 'ml-px' : '',
                        cells[i] ? 'bg-brand-deep/80 hover:bg-brand-deep' : 'bg-white hover:bg-brand-tint',
                      )}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1.5 h-4 text-[11px] text-ink-mute">
        {hover !== null ? `${cellTime(hover)} – ${cellTime(hover + 1)}` : 'Bấm hoặc kéo qua các ô để chọn giờ rảnh (mỗi ô 30 phút).'}
      </p>
    </div>
  );
}
