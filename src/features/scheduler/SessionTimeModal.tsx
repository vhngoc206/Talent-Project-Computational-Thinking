/** Hộp thoại tự chọn giờ cho một phiên học (đổi giờ phiên có sẵn hoặc thêm phiên mới). */
import { useState, type FormEvent } from 'react';
import { Check, Pin, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/FormControls';
import { Modal } from '../../components/ui/Modal';
import type { PinnedSessionInput } from '../../state/AppStateContext';
import type { StudySession, Task } from '../../types';
import { toDateKey } from '../../utils/date';

interface Props {
  /** Có giá trị = đổi giờ phiên này */
  session: StudySession | null;
  tasks: Task[];
  onSave: (input: PinnedSessionInput) => string | null;
  /** Bỏ phiên tự chọn (chỉ có khi phiên đang được ghim) */
  onRemove?: () => void;
  onClose: () => void;
}

const toMin = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function SessionTimeModal({ session, tasks, onSave, onRemove, onClose }: Props) {
  const pending = tasks.filter((t) => t.status !== 'completed');
  const now = new Date();
  // Mặc định cho phiên mới: bắt đầu ở mốc 30 phút kế tiếp, dài 45 phút
  const nextHalf = Math.min(23 * 60, Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / 30) * 30);
  const [taskId, setTaskId] = useState(session?.taskId ?? pending[0]?.id ?? '');
  const [date, setDate] = useState(session?.date ?? toDateKey(now));
  const [start, setStart] = useState(session?.startTime ?? fromMin(nextHalf));
  const [end, setEnd] = useState(session?.endTime ?? fromMin(Math.min(23 * 60 + 59, nextHalf + 45)));
  const [error, setError] = useState('');

  /** Đổi giờ bắt đầu thì giữ nguyên độ dài phiên */
  function changeStart(v: string) {
    const length = Math.max(15, toMin(end) - toMin(start));
    setStart(v);
    if (/^\d{2}:\d{2}$/.test(v)) setEnd(fromMin(Math.min(23 * 60 + 59, toMin(v) + length)));
    setError('');
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const err = onSave({ id: session?.id, taskId, date, startTime: start, endTime: end });
    if (err) setError(err);
    else onClose();
  }

  const minutes = Math.max(0, toMin(end) - toMin(start));
  const formId = 'session-time-form';
  return (
    <Modal
      title={session ? 'Chọn giờ cho phiên học' : 'Thêm phiên học'}
      size="sm"
      onClose={onClose}
      footer={
        <>
          {onRemove && (
            <Button variant="ghost" className="mr-auto text-danger-fg" icon={<Trash2 className="h-4 w-4" />} onClick={onRemove}>
              Bỏ phiên này
            </Button>
          )}
          <Button onClick={onClose}>Hủy</Button>
          <Button type="submit" form={formId} variant="primary" icon={<Check className="h-4 w-4" />}>
            Lưu
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-3" noValidate>
        <Field label="Nhiệm vụ">
          {({ id }) => (
            <select id={id} className="input-base" value={taskId} disabled={!!session} onChange={(e) => setTaskId(e.target.value)}>
              {pending.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Ngày">
          {({ id }) => <input id={id} type="date" min={toDateKey(now)} className="input-base" value={date} onChange={(e) => (setDate(e.target.value), setError(''))} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bắt đầu">{({ id }) => <input id={id} type="time" step={300} className="input-base" value={start} onChange={(e) => changeStart(e.target.value)} />}</Field>
          <Field label="Kết thúc">{({ id }) => <input id={id} type="time" step={300} className="input-base" value={end} onChange={(e) => (setEnd(e.target.value), setError(''))} />}</Field>
        </div>
        <p className="flex items-start gap-2 rounded-xl bg-cream px-3 py-2 text-xs text-ink-soft">
          <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-deep" aria-hidden />
          <span>
            Phiên dài <strong className="text-ink">{minutes} phút</strong>. Lịch tự động sẽ giữ nguyên giờ bạn chọn và xếp phần còn lại của nhiệm vụ vào giờ rảnh khác.
          </span>
        </p>
        {error && (
          <p className="rounded-lg bg-danger-bg px-3 py-2 text-xs font-semibold text-danger-fg" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
