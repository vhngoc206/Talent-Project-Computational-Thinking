import { useMemo, useState } from 'react';
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge, EmptyState, type BadgeTone } from '../components/ui/Badge';
import { Button, IconButton } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { DIFFICULTY_LABEL } from '../constants';
import { SubjectFormModal } from '../features/subjects/SubjectFormModal';
import { routeHref } from '../hooks/useHashRoute';
import { useAppState } from '../state/AppStateContext';
import type { Difficulty, Subject, SubjectInput } from '../types';
import { formatMinutes } from '../utils/date';

type FormState = { mode: 'closed' } | { mode: 'new' } | { mode: 'edit'; subject: Subject };

const DIFFICULTY_TONE: Record<Difficulty, BadgeTone> = { easy: 'safe', medium: 'warn', hard: 'danger' };

export function SubjectsPage() {
  const { data, actions } = useAppState();
  const toast = useToast();
  const [form, setForm] = useState<FormState>({ mode: 'closed' });
  const [deleting, setDeleting] = useState<Subject | null>(null);

  // Thống kê theo từng môn, tính trực tiếp từ danh sách task
  const stats = useMemo(
    () =>
      new Map(
        data.subjects.map((s) => {
          const tasks = data.tasks.filter((t) => t.subjectId === s.id);
          return [
            s.id,
            {
              total: tasks.length,
              pending: tasks.filter((t) => t.status !== 'completed').length,
              minutes: tasks.reduce((sum, t) => sum + t.actualMinutes, 0),
            },
          ];
        }),
      ),
    [data.subjects, data.tasks],
  );

  function handleSubmit(input: SubjectInput) {
    if (form.mode === 'edit') {
      actions.updateSubject(form.subject.id, input);
      toast('Đã cập nhật môn học.');
    } else {
      actions.addSubject(input);
      toast('Đã thêm môn học mới.');
    }
    setForm({ mode: 'closed' });
  }

  const deletingCount = deleting ? (stats.get(deleting.id)?.total ?? 0) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          {data.subjects.length} môn học · {data.tasks.length} nhiệm vụ
        </p>
        <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setForm({ mode: 'new' })}>
          Thêm môn học
        </Button>
      </div>

      {data.subjects.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-6 w-6" />}
          title="Chưa có môn học nào"
          text="Tạo môn học trước, sau đó thêm bài tập và deadline cho từng môn."
          action={<Button variant="primary" onClick={() => setForm({ mode: 'new' })}>Thêm môn học</Button>}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.subjects.map((s) => {
            const st = stats.get(s.id)!;
            return (
              <li key={s.id}>
                <Card className="flex h-full flex-col overflow-hidden !p-0">
                  <div className="h-2" style={{ backgroundColor: s.color }} aria-hidden />
                  <div className="flex flex-1 flex-col p-5">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-xs font-extrabold text-ink-mute">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                          {s.code}
                        </p>
                        <h2 className="mt-0.5 text-base font-black leading-snug">{s.name}</h2>
                      </div>
                      <div className="flex shrink-0">
                        <IconButton label={`Sửa môn ${s.name}`} onClick={() => setForm({ mode: 'edit', subject: s })}>
                          <Pencil className="h-4 w-4" />
                        </IconButton>
                        <IconButton label={`Xóa môn ${s.name}`} className="hover:text-danger-fg" onClick={() => setDeleting(s)}>
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </div>

                    <Badge tone={DIFFICULTY_TONE[s.difficulty]} className="mb-2 self-start">
                      Độ khó: {DIFFICULTY_LABEL[s.difficulty]}
                    </Badge>
                    <p className="mb-4 flex-1 text-sm text-ink-soft">{s.description || 'Chưa có mô tả.'}</p>

                    <dl className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-cream/70 py-2">
                        <dd className="text-lg font-black tabular-nums">{st.total}</dd>
                        <dt className="text-[11px] text-ink-mute">nhiệm vụ</dt>
                      </div>
                      <div className="rounded-xl bg-cream/70 py-2">
                        <dd className="text-lg font-black tabular-nums">{st.pending}</dd>
                        <dt className="text-[11px] text-ink-mute">chưa xong</dt>
                      </div>
                      <div className="rounded-xl bg-cream/70 py-2">
                        <dd className="text-lg font-black tabular-nums">{formatMinutes(st.minutes)}</dd>
                        <dt className="text-[11px] text-ink-mute">đã học</dt>
                      </div>
                    </dl>
                    <a href={routeHref('tasks')} className="mt-3 text-xs font-extrabold text-brand-deep underline-offset-2 hover:underline">
                      Xem nhiệm vụ →
                    </a>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {form.mode !== 'closed' && (
        <SubjectFormModal
          subject={form.mode === 'edit' ? form.subject : null}
          existing={data.subjects}
          onSubmit={handleSubmit}
          onClose={() => setForm({ mode: 'closed' })}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Xóa môn học?"
          confirmLabel="Xóa môn học"
          message={
            deletingCount > 0 ? (
              <>
                Môn <strong className="text-ink">{deleting.name}</strong> đang có <strong className="text-danger-fg">{deletingCount} nhiệm vụ</strong>. Xóa môn học sẽ xóa luôn các nhiệm vụ và giờ học liên quan. Thao tác không thể hoàn tác.
              </>
            ) : (
              <>
                Bạn sắp xóa môn <strong className="text-ink">{deleting.name}</strong>. Thao tác không thể hoàn tác.
              </>
            )
          }
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            actions.deleteSubject(deleting.id);
            toast(`Đã xóa môn "${deleting.name}".`);
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
