import { useState } from 'react';
import { CheckCircle2, ScanText, Wand2 } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { useToast } from '../../components/ui/Toast';
import { DIFFICULTY_LABEL, IMPORTANCE_LABEL } from '../../constants';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { getAiMode, type AiMode } from '../../services/aiService';
import { useAppState } from '../../state/AppStateContext';
import type { TaskInput } from '../../types';
import { formatDeadline, formatMinutes } from '../../utils/date';
import { TaskFormModal } from '../tasks/TaskFormModal';
import { analyzeTask } from './assistantApi';
import { ErrorBox, LoadingBox, SourceBadge } from './AiStatus';
import type { AiResult, TaskDraft } from './types';

const EXAMPLES = [
  'Tôi có bài tập cơ sở dữ liệu gồm 5 câu, hạn nộp thứ Sáu tuần này, độ khó trung bình. Tôi cần khoảng 3 tiếng để hoàn thành.',
  'Báo cáo đồ án lập trình web nộp ngày mai lúc 17h, khá khó, mất 4 tiếng',
  'Ôn tập quiz Marketing Technology thứ Hai tuần sau, dễ, 45 phút',
];

/** A. AI TASK ANALYZER – câu tự nhiên → bản nháp nhiệm vụ → người dùng xác nhận rồi mới lưu. */
export function TaskAnalyzerPanel() {
  const { data, actions } = useAppState();
  const toast = useToast();
  const [text, setText] = useState('');
  const [confirming, setConfirming] = useState<TaskDraft | null>(null);
  const req = useAsyncAction<AiResult<TaskDraft>>();

  const subject = (id: string | null) => data.subjects.find((s) => s.id === id);
  const analyze = (mode: AiMode = getAiMode()) => {
    const input = text.trim();
    if (input.length < 8) {
      toast('Hãy mô tả nhiệm vụ chi tiết hơn (ít nhất vài từ).', 'error');
      return;
    }
    void req.run(() => analyzeTask(input, data, new Date(), mode));
  };

  function save(input: TaskInput) {
    actions.addTask(input);
    setConfirming(null);
    setText('');
    req.reset();
    toast('Đã lưu nhiệm vụ từ AI Task Analyzer.');
  }

  const draft = req.result?.data;

  return (
    <Card>
      <CardHeader
        icon={<ScanText className="h-4 w-4" aria-hidden />}
        title="AI Task Analyzer"
        subtitle="Mô tả bài tập bằng lời, AI tách thành nhiệm vụ để bạn xác nhận"
      />

      <label htmlFor="analyzer-input" className="sr-only">
        Mô tả nhiệm vụ
      </label>
      <textarea
        id="analyzer-input"
        rows={3}
        maxLength={600}
        className="input-base resize-none"
        placeholder="Ví dụ: Tôi có bài tập cơ sở dữ liệu gồm 5 câu, hạn nộp thứ Sáu tuần này…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) analyze();
        }}
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex, i) => (
          <button
            key={ex}
            type="button"
            onClick={() => setText(ex)}
            className="rounded-full bg-cream px-2.5 py-1 text-xs font-bold text-ink-soft hover:bg-brand-tint"
            title={ex}
          >
            Ví dụ {i + 1}
          </button>
        ))}
      </div>

      <div className="mt-3 flex justify-end">
        <Button variant="primary" icon={<Wand2 className="h-4 w-4" />} onClick={() => analyze()} disabled={req.status === 'loading'}>
          Phân tích
        </Button>
      </div>

      <div className="mt-4 space-y-3" aria-live="polite">
        {req.status === 'loading' && <LoadingBox text={getAiMode() === 'gemini' ? 'AI đang phân tích…' : 'Đang phân tích…'} />}
        {req.status === 'error' && <ErrorBox error={req.error} onRetry={() => void req.retry()} onUseDemo={() => analyze('demo')} />}

        {req.status === 'success' && draft && req.result && (
          <div className="anim-fade-up rounded-2xl border border-line p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-extrabold text-ink-soft">Kết quả phân tích – cần bạn xác nhận</p>
              <SourceBadge source={req.result.source} model={req.result.model} />
            </div>
            <p className="text-base font-black">{draft.title}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-ink-mute">Môn học</dt>
                <dd className="font-bold">{subject(draft.subjectId)?.name ?? <span className="text-danger-fg">Chưa xác định</span>}</dd>
              </div>
              <div>
                <dt className="text-ink-mute">Deadline</dt>
                <dd className="font-bold">{draft.deadline ? formatDeadline(draft.deadline) : <span className="text-danger-fg">Chưa xác định</span>}</dd>
              </div>
              <div>
                <dt className="text-ink-mute">Thời gian dự kiến</dt>
                <dd className="font-bold">{formatMinutes(draft.estimatedMinutes)}</dd>
              </div>
              <div>
                <dt className="text-ink-mute">Độ khó</dt>
                <dd className="font-bold">{DIFFICULTY_LABEL[draft.difficulty]}</dd>
              </div>
              <div>
                <dt className="text-ink-mute">Mức quan trọng (gợi ý)</dt>
                <dd>
                  <Badge tone={draft.importance === 'high' ? 'danger' : draft.importance === 'medium' ? 'warn' : 'safe'}>
                    {IMPORTANCE_LABEL[draft.importance]}
                  </Badge>
                </dd>
              </div>
            </dl>
            {draft.notes.length > 0 && (
              <ul className="mt-3 space-y-0.5 rounded-xl bg-cream/70 px-3 py-2 text-xs text-ink-soft">
                {draft.notes.map((n) => (
                  <li key={n}>• {n}</li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button size="sm" onClick={req.reset}>
                Bỏ qua
              </Button>
              <Button size="sm" variant="primary" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => setConfirming(draft)}>
                Kiểm tra & lưu nhiệm vụ
              </Button>
            </div>
          </div>
        )}
      </div>

      {confirming && (
        <TaskFormModal
          task={null}
          subjects={data.subjects}
          dialogTitle="Xác nhận nhiệm vụ từ AI"
          intro={
            <p className="rounded-xl bg-brand-tint px-3 py-2 text-xs font-semibold text-brand-deep">
              Các trường đã được điền sẵn từ kết quả phân tích. Kiểm tra, sửa nếu cần rồi bấm “Thêm nhiệm vụ”.
            </p>
          }
          initial={{
            title: confirming.title,
            subjectId: confirming.subjectId ?? undefined,
            deadline: confirming.deadline ?? undefined,
            difficulty: confirming.difficulty,
            importance: confirming.importance,
            estimatedMinutes: confirming.estimatedMinutes,
            description: confirming.description,
          }}
          onSubmit={save}
          onClose={() => setConfirming(null)}
        />
      )}
    </Card>
  );
}
