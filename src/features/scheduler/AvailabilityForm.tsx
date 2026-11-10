import { useEffect, useState } from 'react';
import { CalendarCog, Copy, Plus, Trash2, Wand2 } from 'lucide-react';
import { Button, IconButton } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { Segmented } from '../../components/ui/FormControls';
import { SESSION_LENGTH_OPTIONS, SESSION_MINUTES_MAX, SESSION_MINUTES_MIN, WEEKDAY_LONG, WEEKDAY_SHORT } from '../../constants';
import type { Availability, TimeSlot } from '../../types';
import { slotMinutes, slotsForDay, weeklyFreeMinutes } from '../../utils/availability';
import { cn } from '../../utils/cn';
import { toDateKey } from '../../utils/date';
import { validateAvailability } from '../../utils/validation';
import { DateOverridesEditor } from './DateOverridesEditor';
import { DayTimelinePicker } from './DayTimelinePicker';

/** Thứ tự hiển thị: T2 → CN (giá trị theo Date.getDay()) */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAYS = [1, 2, 3, 4, 5];
const BREAK_OPTIONS = [0, 5, 10, 15, 20, 30];

interface Props {
  value: Availability;
  /** Lưu thời gian rảnh; `andGenerate` = lưu xong tạo lịch luôn */
  onSave: (availability: Availability, andGenerate: boolean) => void;
}

function nextSlot(slots: TimeSlot[]): TimeSlot {
  if (slots.length === 0) return { start: '19:00', end: '21:00' };
  const last = [...slots].sort((a, b) => a.end.localeCompare(b.end))[slots.length - 1];
  const h = Math.min(21, Number(last.end.slice(0, 2)) + 1);
  return { start: `${String(h).padStart(2, '0')}:00`, end: `${String(h + 2).padStart(2, '0')}:00` };
}

const hoursText = (minutes: number) => {
  const h = Math.round((minutes / 60) * 10) / 10;
  return h === 0 ? 'nghỉ' : `${h}h`;
};
const sortSlots = (slots: TimeSlot[]) => [...slots].sort((a, b) => a.start.localeCompare(b.start));

export function AvailabilityForm({ value, onSave }: Props) {
  const [draft, setDraft] = useState<Availability>(value);
  const [errors, setErrors] = useState<string[]>([]);
  const [exact, setExact] = useState(false);
  // "Tự chọn" thời lượng phiên: bật sẵn nếu giá trị đã lưu không thuộc các mức chọn nhanh
  const [customLength, setCustomLength] = useState(() => !SESSION_LENGTH_OPTIONS.includes(value.sessionMinutes));
  // Ngày đang chỉnh trong chế độ "mỗi ngày khác nhau"
  const [editingDay, setEditingDay] = useState<number>(() => new Date().getDay());

  // Đồng bộ lại khi dữ liệu gốc đổi (ví dụ nạp dữ liệu mẫu)
  useEffect(() => {
    setDraft(value);
    setCustomLength(!SESSION_LENGTH_OPTIONS.includes(value.sessionMinutes));
  }, [value]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(value);
  const perDay = draft.perDay === true;

  const update = (patch: Partial<Availability>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors([]);
  };

  /** Khung giờ đang được chỉnh (chung cho mọi ngày, hoặc của ngày đang chọn) */
  const currentSlots = perDay ? draft.daySlots?.[String(editingDay)] ?? [] : draft.slots;
  const setCurrentSlots = (slots: TimeSlot[]) =>
    perDay ? update({ daySlots: { ...draft.daySlots, [String(editingDay)]: slots } }) : update({ slots });

  const toggleDay = (day: number) =>
    update({ days: draft.days.includes(day) ? draft.days.filter((d) => d !== day) : [...draft.days, day].sort() });
  const setSlot = (i: number, patch: Partial<TimeSlot>) => setCurrentSlots(currentSlots.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  function switchMode(next: boolean) {
    if (next === perDay) return;
    if (next) {
      // Chuyển sang từng ngày: bắt đầu từ khung giờ chung của các ngày đã chọn
      const daySlots: Record<string, TimeSlot[]> = {};
      for (const d of DAY_ORDER) daySlots[String(d)] = slotsForDay(draft, d).map((s) => ({ ...s }));
      update({ perDay: true, daySlots });
    } else {
      // Quay về giống nhau: lấy khung của ngày đang chỉnh làm khung chung
      const slots = (draft.daySlots?.[String(editingDay)] ?? []).map((s) => ({ ...s }));
      update({
        perDay: false,
        slots: slots.length ? slots : draft.slots,
        days: DAY_ORDER.filter((d) => (draft.daySlots?.[String(d)] ?? []).length > 0).sort(),
      });
    }
  }

  function copyTo(targets: number[]) {
    const daySlots = { ...draft.daySlots };
    for (const d of targets) daySlots[String(d)] = currentSlots.map((s) => ({ ...s }));
    update({ daySlots });
  }

  function submit(andGenerate: boolean) {
    const errs = validateAvailability(draft);
    setErrors(errs);
    if (errs.length > 0) return;
    const today = toDateKey(new Date());
    const dateOverrides = Object.fromEntries(
      Object.entries(draft.dateOverrides ?? {})
        .filter(([k]) => k >= today)
        .map(([k, v]) => [k, sortSlots(v)]),
    );
    const base: Availability = { ...draft, dateOverrides };
    const cleaned: Availability = perDay
      ? {
          ...base,
          daySlots: Object.fromEntries(Object.entries(draft.daySlots ?? {}).map(([k, v]) => [k, sortSlots(v)])),
          days: DAY_ORDER.filter((d) => (draft.daySlots?.[String(d)] ?? []).length > 0).sort(),
        }
      : { ...base, slots: sortSlots(draft.slots) };
    onSave(cleaned, andGenerate);
  }

  return (
    <Card>
      <CardHeader icon={<CalendarCog className="h-4 w-4" aria-hidden />} title="Thời gian rảnh" subtitle="Khi nào bạn có thể học?" />

      <Segmented
        className="mb-4"
        label="Cách chọn giờ"
        value={perDay ? 'perDay' : 'same'}
        onChange={(v) => switchMode(v === 'perDay')}
        options={[
          { value: 'same', label: 'Giống nhau mọi ngày' },
          { value: 'perDay', label: 'Mỗi ngày khác nhau' },
        ]}
      />

      {!perDay ? (
        <fieldset className="mb-4">
          <legend className="mb-1.5 text-xs font-extrabold text-ink-soft">Ngày có thể học</legend>
          <div className="grid grid-cols-7 gap-1">
            {DAY_ORDER.map((d) => {
              const on = draft.days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleDay(d)}
                  className={cn('rounded-xl py-2 text-xs font-extrabold transition-colors', on ? 'bg-brand text-ink shadow-sm' : 'bg-cream text-ink-mute hover:bg-brand-tint')}
                >
                  {WEEKDAY_SHORT[d]}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <fieldset className="mb-3">
          <legend className="mb-1.5 text-xs font-extrabold text-ink-soft">Chọn ngày để chỉnh</legend>
          <div className="grid grid-cols-7 gap-1" role="tablist">
            {DAY_ORDER.map((d) => {
              const minutes = (draft.daySlots?.[String(d)] ?? []).reduce((x, s) => x + slotMinutes(s), 0);
              const active = d === editingDay;
              return (
                <button
                  key={d}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setEditingDay(d)}
                  className={cn(
                    'flex flex-col items-center rounded-xl py-1.5 text-xs font-extrabold transition-colors',
                    active ? 'bg-brand-deep text-white shadow-sm' : minutes > 0 ? 'bg-brand text-ink hover:bg-brand-hover' : 'bg-cream text-ink-mute hover:bg-brand-tint',
                  )}
                >
                  {WEEKDAY_SHORT[d]}
                  <span className={cn('text-[10px] font-bold', active ? 'text-white/85' : 'opacity-75')}>{hoursText(minutes)}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <fieldset className="mb-4">
        <legend className="mb-1.5 text-xs font-extrabold text-ink-soft">
          {perDay ? `Giờ rảnh ${WEEKDAY_LONG[editingDay]}` : 'Giờ rảnh trong ngày (áp dụng cho các ngày đã chọn)'}
        </legend>
        <DayTimelinePicker slots={currentSlots} onChange={setCurrentSlots} />

        {currentSlots.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {sortSlots(currentSlots).map((sl) => (
              <span key={sl.start + sl.end} className="rounded-full bg-brand-tint px-2.5 py-0.5 text-[11px] font-extrabold tabular-nums text-brand-deep">
                {sl.start} – {sl.end === '23:59' ? '24:00' : sl.end}
              </span>
            ))}
          </div>
        )}

        {perDay && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => copyTo(WEEKDAYS)} className="inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-[11px] font-extrabold text-ink-soft hover:bg-brand-tint">
              <Copy className="h-3 w-3" aria-hidden /> Áp dụng cho T2–T6
            </button>
            <button type="button" onClick={() => copyTo(DAY_ORDER)} className="inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-[11px] font-extrabold text-ink-soft hover:bg-brand-tint">
              <Copy className="h-3 w-3" aria-hidden /> Áp dụng cho cả tuần
            </button>
          </div>
        )}

        <button type="button" onClick={() => setExact((v) => !v)} className="mt-2 inline-flex items-center gap-1 text-xs font-extrabold text-brand-deep hover:underline" aria-expanded={exact}>
          {exact ? 'Ẩn chỉnh giờ chính xác' : 'Chỉnh giờ chính xác từng phút'}
        </button>
        {exact && (
          <>
            <ul className="mt-2 space-y-2">
              {currentSlots.map((sl, i) => (
                <li key={i} className="flex items-center gap-2">
                  <input type="time" aria-label={`Khung ${i + 1} bắt đầu`} className="input-base py-1.5" value={sl.start} onChange={(e) => setSlot(i, { start: e.target.value })} />
                  <span className="text-ink-mute">–</span>
                  <input type="time" aria-label={`Khung ${i + 1} kết thúc`} className="input-base py-1.5" value={sl.end} onChange={(e) => setSlot(i, { end: e.target.value })} />
                  <IconButton label={`Xóa khung ${i + 1}`} onClick={() => setCurrentSlots(currentSlots.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </li>
              ))}
            </ul>
            {currentSlots.length < 12 && (
              <button type="button" onClick={() => setCurrentSlots([...currentSlots, nextSlot(currentSlots)])} className="mt-2 inline-flex items-center gap-1 text-xs font-extrabold text-brand-deep hover:underline">
                <Plus className="h-3.5 w-3.5" /> Thêm khung giờ
              </button>
            )}
          </>
        )}
      </fieldset>

      <DateOverridesEditor availability={draft} onChange={(dateOverrides) => update({ dateOverrides })} />

      <div className="mb-4">
        <Segmented
          label="Thời lượng mỗi phiên học"
          value={customLength ? -1 : draft.sessionMinutes}
          onChange={(v) => {
            if (v === -1) {
              setCustomLength(true);
              return;
            }
            setCustomLength(false);
            update({ sessionMinutes: v });
          }}
          options={[...SESSION_LENGTH_OPTIONS.map((m) => ({ value: m, label: `${m} phút` })), { value: -1, label: 'Tự chọn' }]}
        />
        {customLength && (
          <label className="mt-2 flex items-center gap-2 text-xs font-bold text-ink-soft">
            Mỗi phiên dài
            <input
              type="number"
              min={SESSION_MINUTES_MIN}
              max={SESSION_MINUTES_MAX}
              step={5}
              value={draft.sessionMinutes}
              onChange={(e) => update({ sessionMinutes: Math.round(Number(e.target.value)) })}
              className="input-base h-9 w-24 py-0 text-center text-sm font-black"
              aria-label="Số phút mỗi phiên học"
            />
            phút <span className="font-semibold text-ink-mute">({SESSION_MINUTES_MIN}–{SESSION_MINUTES_MAX})</span>
          </label>
        )}
      </div>

      <label className="mb-4 block text-xs font-extrabold text-ink-soft">
        Nghỉ giữa các phiên
        <select className="input-base mt-1" value={draft.breakMinutes} onChange={(e) => update({ breakMinutes: Number(e.target.value) })}>
          {BREAK_OPTIONS.map((b) => (
            <option key={b} value={b}>
              {b === 0 ? 'Không nghỉ' : `${b} phút`}
            </option>
          ))}
        </select>
      </label>

      <label className="mb-4 flex cursor-pointer items-start gap-2 rounded-xl bg-cream p-3 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#4f8a4b]" checked={draft.autoReschedule !== false} onChange={(e) => update({ autoReschedule: e.target.checked })} />
        <span>
          <span className="block font-bold text-ink">Tự động sắp xếp lịch</span>
          <span className="text-xs text-ink-mute">
            Lịch tự xếp lại khi bạn thêm/sửa nhiệm vụ hay giờ rảnh. Phiên học bị lỡ được dời sang giờ rảnh tiếp theo cho tới khi bạn tick hoàn thành.
          </span>
        </span>
      </label>

      <p className="mb-3 rounded-xl bg-cream/80 px-3 py-2 text-xs text-ink-soft">
        Tổng thời gian rảnh mỗi tuần: <strong className="text-ink">{Math.round((weeklyFreeMinutes(draft) / 60) * 10) / 10} giờ</strong>
      </p>

      {errors.length > 0 && (
        <ul className="mb-3 space-y-1 rounded-xl bg-danger-bg px-3 py-2 text-xs font-semibold text-danger-fg" role="alert">
          {errors.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" className="flex-1" icon={<Wand2 className="h-4 w-4" />} onClick={() => submit(true)}>
          Lưu & tạo lịch
        </Button>
        <Button onClick={() => submit(false)} disabled={!dirty}>
          Chỉ lưu
        </Button>
      </div>
    </Card>
  );
}
