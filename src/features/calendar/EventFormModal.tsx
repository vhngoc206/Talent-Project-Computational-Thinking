import { useState, type FormEvent } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Field, Segmented } from '../../components/ui/FormControls';
import { Modal } from '../../components/ui/Modal';
import type { CalendarEvent, CalendarEventInput, EventRepeat } from '../../types';
import { cn } from '../../utils/cn';
import { validateEvent } from '../../utils/events';

export const EVENT_COLORS = ['#5B8C5A', '#6E8FB5', '#C9822B', '#B5655B', '#8E7CB8', '#4E9A93', '#C57A95', '#7A6A4F'];

const REPEAT_OPTIONS: Array<{ value: EventRepeat; label: string }> = [
  { value: 'none', label: 'Không lặp' },
  { value: 'daily', label: 'Hằng ngày' },
  { value: 'weekly', label: 'Hằng tuần' },
];

/** Danh sách giờ chọn nhanh, bước 15 phút (giống Google Calendar) */
const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`).concat('23:59');

interface Props {
  /** Có giá trị = đang sửa */
  event: CalendarEvent | null;
  /** Giá trị khởi tạo khi tạo mới (ngày/giờ của ô vừa bấm) */
  initial: Partial<CalendarEventInput>;
  onSubmit: (input: CalendarEventInput) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function EventFormModal({ event, initial, onSubmit, onDelete, onClose }: Props) {
  const start: CalendarEventInput = {
    title: '',
    date: '',
    startTime: '09:00',
    endTime: '10:00',
    allDay: false,
    color: EVENT_COLORS[0],
    location: '',
    description: '',
    repeat: 'none',
    repeatUntil: null,
    blocksStudy: true,
    ...initial,
    ...(event ?? {}),
  };
  const [form, setForm] = useState<CalendarEventInput>(start);
  const [errors, setErrors] = useState<ReturnType<typeof validateEvent>>({});
  const set = <K extends keyof CalendarEventInput>(key: K, value: CalendarEventInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  /** Đổi giờ bắt đầu thì giữ nguyên độ dài sự kiện */
  function changeStart(value: string) {
    const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
    const duration = Math.max(15, toMin(form.endTime) - toMin(form.startTime));
    const end = Math.min(23 * 60 + 59, toMin(value) + duration);
    set('startTime', value);
    set('endTime', `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const result = validateEvent(form);
    setErrors(result);
    if (Object.keys(result).length === 0) onSubmit({ ...form, repeatUntil: form.repeat === 'none' ? null : form.repeatUntil });
  }

  const formId = 'event-form';
  return (
    <Modal
      title={event ? 'Sửa sự kiện' : 'Sự kiện mới'}
      onClose={onClose}
      footer={
        <>
          {onDelete && (
            <Button variant="ghost" className="mr-auto text-danger-fg" icon={<Trash2 className="h-4 w-4" />} onClick={onDelete}>
              Xóa
            </Button>
          )}
          <Button onClick={onClose}>Hủy</Button>
          <Button type="submit" form={formId} variant="primary" icon={<Check className="h-4 w-4" />}>
            {event ? 'Lưu' : 'Thêm sự kiện'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="Tên sự kiện" error={errors.title}>
          {({ id, invalid, describedBy }) => (
            <input
              id={id}
              autoFocus
              aria-invalid={invalid}
              aria-describedby={describedBy}
              className={cn('input-base text-base font-bold', invalid && 'input-error')}
              placeholder="Ví dụ: Lên lớp Cơ sở dữ liệu"
              maxLength={80}
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
            />
          )}
        </Field>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <Field label="Ngày" error={errors.date}>
            {({ id, invalid, describedBy }) => (
              <input id={id} type="date" aria-invalid={invalid} aria-describedby={describedBy} className={cn('input-base', invalid && 'input-error')} value={form.date} onChange={(e) => set('date', e.target.value)} />
            )}
          </Field>
          {!form.allDay && (
            <>
              <Field label="Bắt đầu" error={errors.startTime}>
                {({ id }) => (
                  <select id={id} className="input-base sm:w-28" value={form.startTime} onChange={(e) => changeStart(e.target.value)}>
                    {TIME_OPTIONS.includes(form.startTime) ? null : <option value={form.startTime}>{form.startTime}</option>}
                    {TIME_OPTIONS.slice(0, -1).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Kết thúc" error={errors.endTime}>
                {({ id, invalid, describedBy }) => (
                  <select id={id} aria-invalid={invalid} aria-describedby={describedBy} className={cn('input-base sm:w-28', invalid && 'input-error')} value={form.endTime} onChange={(e) => set('endTime', e.target.value)}>
                    {TIME_OPTIONS.includes(form.endTime) ? null : <option value={form.endTime}>{form.endTime}</option>}
                    {TIME_OPTIONS.filter((t) => t > form.startTime).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </>
          )}
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-ink-soft">
          <input type="checkbox" className="h-4 w-4 accent-[#4f8a4b]" checked={form.allDay} onChange={(e) => set('allDay', e.target.checked)} />
          Cả ngày
        </label>

        <div className="space-y-3">
          <Segmented label="Lặp lại" value={form.repeat} options={REPEAT_OPTIONS} onChange={(v) => set('repeat', v)} />
          {form.repeat !== 'none' && (
            <Field label="Lặp đến ngày (để trống = mãi mãi)" error={errors.repeatUntil}>
              {({ id, invalid }) => (
                <input id={id} type="date" aria-invalid={invalid} className={cn('input-base', invalid && 'input-error')} value={form.repeatUntil ?? ''} min={form.date} onChange={(e) => set('repeatUntil', e.target.value || null)} />
              )}
            </Field>
          )}
        </div>

        <Field label="Địa điểm">
          {({ id }) => <input id={id} className="input-base" placeholder="Phòng học, Google Meet…" maxLength={80} value={form.location} onChange={(e) => set('location', e.target.value)} />}
        </Field>
        <Field label="Ghi chú">
          {({ id }) => <textarea id={id} rows={2} className="input-base resize-none" maxLength={300} value={form.description} onChange={(e) => set('description', e.target.value)} />}
        </Field>

        <div>
          <span className="mb-1 block text-xs font-extrabold text-ink-soft">Màu</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Màu sự kiện">
            {EVENT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={form.color === c}
                aria-label={`Màu ${c}`}
                onClick={() => set('color', c)}
                className={cn('h-7 w-7 rounded-full ring-offset-2 transition', form.color === c ? 'ring-2 ring-ink' : 'hover:scale-110')}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-cream p-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#4f8a4b]" checked={form.blocksStudy} onChange={(e) => set('blocksStudy', e.target.checked)} />
          <span>
            <span className="block font-bold text-ink">Tôi bận trong thời gian này</span>
            <span className="text-xs text-ink-mute">Lịch học tự động sẽ không xếp giờ học trùng với sự kiện này.</span>
          </span>
        </label>
        {event && event.repeat !== 'none' && <p className="text-xs text-ink-mute">Thay đổi sẽ áp dụng cho mọi lần lặp của sự kiện này.</p>}
      </form>
    </Modal>
  );
}
