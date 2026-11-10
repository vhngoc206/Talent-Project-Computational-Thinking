import { useMemo, useState } from 'react';
import { ClipboardList, Plus, Search, SearchX, Trophy } from 'lucide-react';
import { rankTasks } from '../algorithms/priorityScheduler';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { EmptyState } from '../components/ui/Badge';
import { ConfirmDialog } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { STATUS_LABEL, STATUS_OPTIONS } from '../constants';
import { LEVEL_TONE } from '../features/tasks/PriorityBreakdown';
import { TaskFormModal } from '../features/tasks/TaskFormModal';
import { TaskRow } from '../features/tasks/TaskRow';
import { DEFAULT_FILTERS, filterAndSortTasks, type TaskFilters, type TaskSort } from '../features/tasks/taskSelectors';
import { useNow } from '../hooks/useNow';
import { useAppState } from '../state/AppStateContext';
import type { Task, TaskInput, TaskStatus } from '../types';
import { formatDeadline } from '../utils/date';

type FormState = { mode: 'closed' } | { mode: 'new' } | { mode: 'edit'; task: Task };

export function TasksPage() {
  const { data, actions } = useAppState();
  const toast = useToast();
  const now = useNow(30_000);

  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS);
  const [form, setForm] = useState<FormState>({ mode: 'closed' });
  const [deleting, setDeleting] = useState<Task | null>(null);

  const subjectById = useMemo(() => new Map(data.subjects.map((s) => [s.id, s])), [data.subjects]);
  // Kết quả Priority Engine cho tất cả task chưa xong – dùng cho cả bảng "Top ưu tiên" và từng dòng
  const ranked = useMemo(() => rankTasks(data.tasks, now), [data.tasks, now]);
  const priorityById = useMemo(() => new Map(ranked.map((r, i) => [r.task.id, { result: r, rank: i + 1 }])), [ranked]);
  const visible = useMemo(() => filterAndSortTasks(data.tasks, data.subjects, filters, now), [data.tasks, data.subjects, filters, now]);

  const setFilter = <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const hasFilter = filters.search !== '' || filters.subjectId !== 'all' || filters.status !== 'all';

  function handleSubmit(input: TaskInput) {
    if (form.mode === 'edit') {
      actions.updateTask(form.task.id, input);
      toast('Đã cập nhật nhiệm vụ.');
    } else {
      actions.addTask(input);
      toast('Đã thêm nhiệm vụ mới.');
    }
    setForm({ mode: 'closed' });
  }

  function handleSetStatus(task: Task, status: TaskStatus) {
    actions.setTaskStatus(task.id, status);
    if (status === 'completed') toast(`Hoàn thành "${task.title}" – làm tốt lắm!`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          {data.tasks.length} nhiệm vụ · {ranked.length} chưa hoàn thành
        </p>
        <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setForm({ mode: 'new' })}>
          Thêm nhiệm vụ
        </Button>
      </div>

      {/* Smart Priority Engine */}
      <Card>
        <CardHeader
          icon={<Trophy className="h-4 w-4" aria-hidden />}
          title="Ưu tiên hàng đầu"
          subtitle="Dựa trên deadline, mức quan trọng và độ khó"
        />
        {ranked.length === 0 ? (
          <p className="rounded-2xl bg-cream/70 p-4 text-sm text-ink-soft">Không còn nhiệm vụ nào cần làm – bạn đã hoàn thành tất cả!</p>
        ) : (
          <ol className="grid gap-3 md:grid-cols-3">
            {ranked.slice(0, 3).map((r, i) => (
              <li key={r.task.id} className="rounded-2xl bg-cream/70 p-3.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-sm font-black text-ink">{i + 1}</span>
                  <Badge tone={LEVEL_TONE[r.level]} className="tabular-nums">
                    {r.score.toFixed(2)} điểm
                  </Badge>
                </div>
                <p className="line-clamp-2 text-sm font-extrabold" title={r.task.title}>
                  {r.task.title}
                </p>
                <p className="mt-0.5 text-xs text-ink-mute">
                  {subjectById.get(r.task.subjectId)?.code} · {formatDeadline(r.task.deadline)}
                </p>
                <p className="mt-2 text-xs text-ink-soft">{r.reasons[0]}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {/* Bộ lọc */}
      <Card className="p-4">
        <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-12">
          <div className="relative sm:col-span-2 xl:col-span-4">
            <label htmlFor="task-search" className="sr-only">
              Tìm kiếm nhiệm vụ
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden />
            <input
              id="task-search"
              type="search"
              className="input-base pl-9"
              placeholder="Tìm theo tên, mô tả, môn học…"
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
            />
          </div>
          <label className="text-xs font-extrabold text-ink-soft xl:col-span-3">
            Môn học
            <select className="input-base mt-1" value={filters.subjectId} onChange={(e) => setFilter('subjectId', e.target.value)}>
              <option value="all">Tất cả môn</option>
              {data.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} – {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-extrabold text-ink-soft xl:col-span-2">
            Trạng thái
            <select className="input-base mt-1" value={filters.status} onChange={(e) => setFilter('status', e.target.value as TaskStatus | 'all')}>
              <option value="all">Tất cả</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-extrabold text-ink-soft sm:col-span-2 xl:col-span-3">
            Sắp xếp
            <select className="input-base mt-1" value={filters.sort} onChange={(e) => setFilter('sort', e.target.value as TaskSort)}>
              <option value="priority">Ưu tiên cao nhất</option>
              <option value="deadline_asc">Deadline gần nhất</option>
              <option value="deadline_desc">Deadline xa nhất</option>
            </select>
          </label>
        </div>
      </Card>

      {/* Danh sách */}
      <div>
        <p className="mb-2 px-1 text-xs font-semibold text-ink-soft" aria-live="polite">
          Hiển thị {visible.length} / {data.tasks.length} nhiệm vụ
          {hasFilter && (
            <button className="ml-2 font-extrabold text-brand-deep underline-offset-2 hover:underline" onClick={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort })}>
              Xóa bộ lọc
            </button>
          )}
        </p>

        {data.tasks.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="Chưa có nhiệm vụ nào"
            text="Thêm bài tập đầu tiên để SmartStudy AI tính độ ưu tiên và lập lịch học cho bạn."
            action={<Button variant="primary" onClick={() => setForm({ mode: 'new' })}>Thêm nhiệm vụ</Button>}
          />
        ) : visible.length === 0 ? (
          <EmptyState icon={<SearchX className="h-6 w-6" />} title="Không tìm thấy nhiệm vụ phù hợp" text="Thử đổi từ khóa hoặc bỏ bớt bộ lọc." />
        ) : (
          <ul className="space-y-2.5">
            {visible.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                subject={subjectById.get(t.subjectId)}
                priority={priorityById.get(t.id)?.result}
                rank={priorityById.get(t.id)?.rank}
                now={now}
                onSetStatus={(s) => handleSetStatus(t, s)}
                onEdit={() => setForm({ mode: 'edit', task: t })}
                onDelete={() => setDeleting(t)}
              />
            ))}
          </ul>
        )}
      </div>

      {form.mode !== 'closed' && (
        <TaskFormModal
          task={form.mode === 'edit' ? form.task : null}
          subjects={data.subjects}
          defaultSubjectId={filters.subjectId !== 'all' ? filters.subjectId : undefined}
          onSubmit={handleSubmit}
          onClose={() => setForm({ mode: 'closed' })}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Xóa nhiệm vụ?"
          confirmLabel="Xóa"
          message={
            <>
              Bạn sắp xóa <strong className="text-ink">“{deleting.title}”</strong> cùng toàn bộ giờ học đã ghi nhận cho nhiệm vụ này. Thao tác không thể hoàn tác.
            </>
          }
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            actions.deleteTask(deleting.id);
            toast('Đã xóa nhiệm vụ.');
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
