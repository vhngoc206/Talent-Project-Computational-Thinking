import { useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Field, Segmented } from '../../components/ui/FormControls';
import { Modal } from '../../components/ui/Modal';
import { DIFFICULTY_LABEL, DIFFICULTY_OPTIONS, SUBJECT_COLORS } from '../../constants';
import type { Subject, SubjectInput } from '../../types';
import { cn } from '../../utils/cn';
import { validateSubject, type FieldErrors } from '../../utils/validation';

interface Props {
  /** Có giá trị = đang sửa; null = thêm mới */
  subject: Subject | null;
  existing: Subject[];
  onSubmit: (input: SubjectInput) => void;
  onClose: () => void;
}

export function SubjectFormModal({ subject, existing, onSubmit, onClose }: Props) {
  const isEdit = subject !== null;
  // Gợi ý màu chưa dùng cho môn mới
  const suggestedColor = SUBJECT_COLORS.find((c) => !existing.some((s) => s.color.toLowerCase() === c)) ?? SUBJECT_COLORS[0];

  const [name, setName] = useState(subject?.name ?? '');
  const [code, setCode] = useState(subject?.code ?? '');
  const [color, setColor] = useState(subject?.color ?? suggestedColor);
  const [difficulty, setDifficulty] = useState(subject?.difficulty ?? 'medium');
  const [description, setDescription] = useState(subject?.description ?? '');
  const [errors, setErrors] = useState<FieldErrors<SubjectInput>>({});
  const clearError = (key: keyof SubjectInput) => setErrors((e) => ({ ...e, [key]: undefined }));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const input: SubjectInput = { name, code, color, difficulty, description };
    const result = validateSubject(input, existing, subject?.id);
    setErrors(result.errors);
    if (result.valid) onSubmit(input);
  }

  const formId = 'subject-form';

  return (
    <Modal
      title={isEdit ? 'Sửa môn học' : 'Thêm môn học'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" type="submit" form={formId}>
            {isEdit ? 'Lưu thay đổi' : 'Thêm môn học'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-3">
        <Field label="Tên môn học *" error={errors.name} className="sm:col-span-2">
          {({ id, invalid, describedBy }) => (
            <input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              autoFocus
              className={`input-base ${invalid ? 'input-error' : ''}`}
              value={name}
              maxLength={80}
              placeholder="Ví dụ: Cơ sở dữ liệu"
              onChange={(e) => {
                setName(e.target.value);
                clearError('name');
              }}
            />
          )}
        </Field>
        <Field label="Mã môn *" error={errors.code}>
          {({ id, invalid, describedBy }) => (
            <input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              className={`input-base uppercase ${invalid ? 'input-error' : ''}`}
              value={code}
              maxLength={20}
              placeholder="DB101"
              onChange={(e) => {
                setCode(e.target.value);
                clearError('code');
              }}
            />
          )}
        </Field>

        <div className="sm:col-span-3">
          <span className="mb-1 block text-xs font-extrabold text-ink-soft" id="subject-color-label">
            Màu đại diện
          </span>
          <div role="radiogroup" aria-labelledby="subject-color-label" className="flex flex-wrap items-center gap-2">
            {SUBJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color.toLowerCase() === c}
                aria-label={`Màu ${c}`}
                onClick={() => setColor(c)}
                className={cn('flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 transition-transform hover:scale-110', color.toLowerCase() === c && 'ring-2 ring-ink')}
                style={{ backgroundColor: c }}
              >
                {color.toLowerCase() === c && <Check className="h-4 w-4 text-ink" aria-hidden />}
              </button>
            ))}
            <label className="ml-1 flex items-center gap-1.5 text-xs font-bold text-ink-soft">
              Tùy chọn
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-8 cursor-pointer rounded-lg border border-line bg-white p-0.5" aria-label="Chọn màu tùy chỉnh" />
            </label>
          </div>
          {errors.color && <p className="mt-1 text-xs font-semibold text-danger-fg">{errors.color}</p>}
        </div>

        <Segmented className="sm:col-span-3" label="Mức độ khó của môn" value={difficulty} onChange={setDifficulty} options={DIFFICULTY_OPTIONS.map((v) => ({ value: v, label: DIFFICULTY_LABEL[v] }))} />

        <Field label="Mô tả" error={errors.description} className="sm:col-span-3">
          {({ id, describedBy }) => (
            <textarea id={id} aria-describedby={describedBy} rows={3} className="input-base resize-none" value={description} maxLength={500} placeholder="Nội dung chính, giảng viên, hình thức thi…" onChange={(e) => setDescription(e.target.value)} />
          )}
        </Field>
      </form>
    </Modal>
  );
}
