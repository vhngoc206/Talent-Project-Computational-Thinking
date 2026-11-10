/** "Ngày đặc biệt": giờ rảnh riêng cho một ngày cụ thể, thay cho lịch tuần của ngày đó. */
import { useState } from 'react';
import { CalendarPlus, X } from 'lucide-react';
import { WEEKDAY_SHORT } from '../../constants';
import type { Availability, TimeSlot } from '../../types';
import { slotMinutes, slotsForDay } from '../../utils/availability';
import { cn } from '../../utils/cn';
import { toDateKey } from '../../utils/date';
import { dateAt } from '../../utils/events';
import { DayTimelinePicker } from './DayTimelinePicker';

const label = (key: string) => {
  const d = dateAt(key);
  return `${WEEKDAY_SHORT[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const hours = (slots: TimeSlot[]) => {
  const m = slots.reduce((x, s) => x + slotMinutes(s), 0);
  return m === 0 ? 'nghỉ cả ngày' : `${Math.round((m / 60) * 10) / 10}h rảnh`;
};

interface Props {
  availability: Availability;
  onChange: (overrides: Record<string, TimeSlot[]>) => void;
}

export function DateOverridesEditor({ availability, onChange }: Props) {
  const today = toDateKey(new Date());
  const overrides = availability.dateOverrides ?? {};
  const upcoming = Object.keys(overrides)
    .filter((k) => k >= today)
    .sort();
  const [selected, setSelected] = useState<string | null>(null);
  const [pick, setPick] = useState('');
  const active = selected && overrides[selected] ? selected : null;

  function add() {
    if (!pick || pick < today) return;
    if (!overrides[pick]) {
      // Bắt đầu từ giờ rảnh theo lịch tuần của ngày đó, rồi chỉnh tiếp
      onChange({ ...overrides, [pick]: slotsForDay(availability, dateAt(pick).getDay()).map((s) => ({ ...s })) });
    }
    setSelected(pick);
    setPick('');
  }

  function remove(key: string) {
    const next = { ...overrides };
    delete next[key];
    onChange(next);
    if (selected === key) setSelected(null);
  }

  return (
    <fieldset className="mb-4 rounded-xl border border-line p-3">
      <legend className="px-1 text-xs font-extrabold text-ink-soft">Ngày đặc biệt</legend>
      <p className="mb-2 text-[11px] text-ink-mute">Đặt giờ rảnh riêng cho một ngày cụ thể (ngày nghỉ lễ, ngày thi, ngày bận…). Ngày đó sẽ không theo lịch tuần.</p>

      <div className="flex gap-2">
        <label htmlFor="override-date" className="sr-only">
          Chọn ngày
        </label>
        <input id="override-date" type="date" min={today} value={pick} onChange={(e) => setPick(e.target.value)} className="input-base h-9 py-0" />
        <button
          type="button"
          onClick={add}
          disabled={!pick || pick < today}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg bg-brand px-3 text-xs font-extrabold text-ink hover:bg-brand-hover disabled:opacity-50"
        >
          <CalendarPlus className="h-3.5 w-3.5" aria-hidden /> Thêm ngày
        </button>
      </div>

      {upcoming.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {upcoming.map((k) => (
            <span
              key={k}
              className={cn('inline-flex items-center rounded-full text-[11px] font-extrabold', k === active ? 'bg-brand-deep text-white' : 'bg-cream text-ink-soft')}
            >
              <button type="button" onClick={() => setSelected(k === active ? null : k)} className="py-1 pl-2.5 pr-1" aria-pressed={k === active}>
                {label(k)} · {hours(overrides[k])}
              </button>
              <button type="button" onClick={() => remove(k)} className="rounded-full p-1 pr-1.5 opacity-70 hover:opacity-100" aria-label={`Bỏ ngày đặc biệt ${label(k)}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {active && (
        <div className="mt-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-extrabold text-ink">Giờ rảnh {label(active)}</p>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => onChange({ ...overrides, [active]: [] })} className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-extrabold text-ink-soft hover:bg-brand-tint">
                Nghỉ cả ngày
              </button>
              <button type="button" onClick={() => remove(active)} className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-extrabold text-ink-soft hover:bg-brand-tint">
                Theo lịch tuần
              </button>
            </div>
          </div>
          <DayTimelinePicker slots={overrides[active]} onChange={(slots) => onChange({ ...overrides, [active]: slots })} />
        </div>
      )}
    </fieldset>
  );
}
