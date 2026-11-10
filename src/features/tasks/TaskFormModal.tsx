import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { Field, Segmented } from '../../components/ui/FormControls';
import { Modal } from '../../components/ui/Modal';
import {
  DIFFICULTY_LABEL,
  DIFFICULTY_OPTIONS,
  IMPORTANCE_LABEL,
  IMPORTANCE_OPTIONS,
  STATUS_LABEL,
  STATUS_OPTIONS,
} from '../../constants';
import type { Subject, Task, TaskInput } from '../../types';
import { atTime, formatMinutes, isoToLocalInput, localInputToIso } from '../../utils/date';
import { validateTask, type FieldErrors } from '../../utils/validation';

interface Props {
  /** Có giá trị = đang sửa; null = thêm mới */
  task: Task | null;
  subjects: Subject[];
  defaultSubjectId?: string;
  onSubmit: (input: TaskInput) => void;
  onClose: () => void;
  /** Giá trị điền sẵn khi thêm mới (ví dụ bản nháp từ AI Task Analyzer) */
  initial?: Partial<TaskInput>;
  /** Nội dung hiển thị phía trên form */
  intro?: ReactNode;
  /** Tiêu đề hộp thoại (mặc định Thêm/Sửa nhiệm vụ) */
  dialogTitle?: string;
}

const QUICK_MINUTES = [30, 60, 90, 120, 180, 240];

export function TaskFormModal({ task, subjects, defaultSubjectId, onSubmit, onClose, initial, intro, dialogTitle }: Props) {
  const isEdit = task !== null;
  const defaultDeadline = useMemo(() => isoToLocalInput(atTime(new Date(), 1, 23, 59).toISOString()), []);

  const [title, setTitle] = useState(task?.title ?? initial?.title ?? '');
  const [subjectId, setSubjectId] = useState(task?.subjectId ?? (initial?.subjectId || defaultSubjectId) ?? subjects[0]?.id ?? '');
  const [description, setDescription] = useState(task?.description ?? initial?.description ?? '');
  const [deadline, setDeadline] = useState(task ? isoToLocalInput(task.deadline) : initial?.deadline ? isoToLocalInput(initial.deadline) : defaultDeadline);
  const [estimated, setEstimated] = useState(String(task?.estimatedMinutes ?? initial?.estimatedMinutes ?? 60));
  const [actual, setActual] = useState(String(task?.actualMinutes ?? 0));
  const [difficulty, setDifficulty] = useState(task?.difficulty ?? initial?.difficulty ?? 'medium');
  const [importance, setImportance] = useState(task?.importance ?? initial?.importance ?? 'medium');
  const [status, setStatus] = useState(task?.status ?? 'todo');
  const [errors, setErrors] = useState<FieldErrors<TaskInput>>({});

  const deadlineIso = localInputToIso(deadline);
  const pastWarning = deadlineIso && status !== 'completed' && new Date(deadlineIso).getTime() < Date.now();
  const clearError = (key: keyof TaskInput) => setErrors((e) => ({ ...e, [key]: undefined }));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const input: TaskInput = {
      title,
      subjectId,
      description,
      deadline: deadlineIso,
      estimatedMinutes: Number(estimated),
      actualMinutes: actual.trim() === '' ? 0 : Number(actual),
      difficulty,
      importance,
      status,
    };
    const result = validateTask(input, subjects);
    setErrors(result.errors);
    if (result.valid) onSubmit(input);
  }

  const formId = 'task-form';
  const noSubjects = subjects.length === 0;

  return (
    <Modal
      title={dialogTitle ?? (isEdit ? 'Sửa nhiệm vụ' : 'Thêm nhiệm vụ')}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" type="submit" form={formId} disabled={noSubjects}>
            {isEdit ? 'Lưu thay đổi' : 'Thêm nhiệm vụ'}
          </Button>
        </>
      }
    >
      {intro && <div className="mb-4">{intro}</div>}
      {noSubjects ? (
        <p className="rounded-xl bg-warn-bg p-4 text-sm font-semibold text-warn-fg">Bạn cần tạo ít nhất một môn học trước khi thêm nhiệm vụ.</p>
      ) : (
        <form id={formId} onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label="Tên nhiệm vụ *" error={errors.title} className="sm:col-span-2">
            {({ id, invalid, describedBy }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                autoFocus
                className={`input-base ${invalid ? 'input-error' : ''}`}
                value={title}
                maxLength={140}
                placeholder="Ví dụ: Bài tập SQL – truy vấn lồng nhau"
                onChange={(e) => {
                  setTitle(e.target.value);
                  clearError('title');
                }}
              />
            )}
          </Field>

          <Field label="Môn học *" error={errors.subjectId}>
            {({ id, invalid, describedBy }) => (
              <select
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                className={`input-base ${invalid ? 'input-error' : ''}`}
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  clearError('subjectId');
                }}
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} – {s.name}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field
            label="Deadline *"
            error={errors.deadline}
            hint={pastWarning ? 'Deadline đã qua – nhiệm vụ sẽ được tính là quá hạn.' : undefined}
          >
            {({ id, invalid, describedBy }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                type="datetime-local"
                className={`input-base ${invalid ? 'input-error' : ''}`}
                value={deadline}
                onChange={(e) => {
                  setDeadline(e.target.value);
                  clearError('deadline');
                }}
              />
            )}
          </Field>

          <Field label="Mô tả" error={errors.description} className="sm:col-span-2">
            {({ id, describedBy }) => (
              <textarea id={id} aria-describedby={describedBy} rows={2} className="input-base resize-none" value={description} maxLength={500} placeholder="Yêu cầu, tài liệu cần đọc…" onChange={(e) => setDescription(e.target.value)} />
            )}
          </Field>

          <Field
            label="Thời gian học dự kiến (phút) *"
            error={errors.estimatedMinutes}
            hint={Number.isInteger(Number(estimated)) && Number(estimated) > 0 ? `= ${formatMinutes(Number(estimated))}` : undefined}
          >
            {({ id, invalid, describedBy }) => (
              <>
                <input
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  type="number"
                  min={5}
                  step={5}
                  inputMode="numeric"
                  className={`input-base ${invalid ? 'input-error' : ''}`}
                  value={estimated}
                  onChange={(e) => {
                    setEstimated(e.target.value);
                    clearError('estimatedMinutes');
                  }}
                />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {QUICK_MINUTES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setEstimated(String(m));
                        clearError('estimatedMinutes');
                      }}
                      className="rounded-full bg-cream px-2 py-0.5 text-xs font-bold text-ink-soft hover:bg-brand-tint"
                    >
                      {formatMinutes(m)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </Field>

          <Field label="Thời gian đã học (phút)" error={errors.actualMinutes} hint={isEdit ? undefined : 'Thường để 0 – Pomodoro sẽ tự cộng dần.'}>
            {({ id, invalid, describedBy }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                type="number"
                min={0}
                step={5}
                inputMode="numeric"
                className={`input-base ${invalid ? 'input-error' : ''}`}
                value={actual}
                onChange={(e) => {
                  setActual(e.target.value);
                  clearError('actualMinutes');
                }}
              />
            )}
          </Field>

          <Segmented label="Độ khó" value={difficulty} onChange={setDifficulty} options={DIFFICULTY_OPTIONS.map((v) => ({ value: v, label: DIFFICULTY_LABEL[v] }))} />
          <Segmented label="Mức quan trọng" value={importance} onChange={setImportance} options={IMPORTANCE_OPTIONS.map((v) => ({ value: v, label: IMPORTANCE_LABEL[v] }))} />
          <Segmented className="sm:col-span-2" label="Trạng thái" value={status} onChange={setStatus} options={STATUS_OPTIONS.map((v) => ({ value: v, label: STATUS_LABEL[v] }))} />
        </form>
      )}
    </Modal>
  );
}
