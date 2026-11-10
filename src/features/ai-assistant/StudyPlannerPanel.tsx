import type { ReactNode } from 'react';
import { AlertTriangle, CalendarRange, Lightbulb, Target, Wand2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { getAiMode, type AiMode } from '../../services/aiService';
import { useAppState } from '../../state/AppStateContext';
import { planStudy } from './assistantApi';
import { ErrorBox, LoadingBox, SourceBadge } from './AiStatus';
import { SimpleMarkdown } from './SimpleMarkdown';
import type { AiResult, PlanItem, StudyPlan } from './types';

function Section({ icon, title, children, tone = 'bg-cream/70' }: { icon: ReactNode; title: string; children: ReactNode; tone?: string }) {
  return (
    <div className={`rounded-2xl p-4 ${tone}`}>
      <p className="mb-2 flex items-center gap-2 text-sm font-extrabold">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

/** B. AI STUDY PLANNER – phân tích danh sách task + lịch rảnh và đưa ra kế hoạch. */
export function StudyPlannerPanel() {
  const { data } = useAppState();
  const req = useAsyncAction<AiResult<StudyPlan>>();
  const taskById = new Map(data.tasks.map((t) => [t.id, t]));
  const subjectById = new Map(data.subjects.map((s) => [s.id, s]));

  const run = (mode: AiMode = getAiMode()) => void req.run(() => planStudy(data, new Date(), mode));
  const plan = req.result?.data;

  const items = (list: PlanItem[], empty: string) =>
    list.length === 0 ? (
      <p className="text-xs text-ink-soft">{empty}</p>
    ) : (
      <ul className="space-y-2 text-xs text-ink-soft">
        {list.map((it) => {
          const t = taskById.get(it.taskId);
          const s = t ? subjectById.get(t.subjectId) : undefined;
          return (
            <li key={it.taskId + it.text} className="flex gap-2">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s?.color ?? '#ccc' }} aria-hidden />
              <span>
                <strong className="text-ink">{t?.title}</strong>
                {s && <span className="text-ink-mute"> · {s.code}</span>}
                <br />
                {it.text}
              </span>
            </li>
          );
        })}
      </ul>
    );

  return (
    <Card>
      <CardHeader
        icon={<CalendarRange className="h-4 w-4" aria-hidden />}
        title="AI Study Planner"
        subtitle="Dựa trên điểm ưu tiên, deadline, thời gian rảnh và lịch học hiện tại"
        action={
          <Button size="sm" variant="primary" icon={<Wand2 className="h-3.5 w-3.5" />} onClick={() => run()} disabled={req.status === 'loading'}>
            {plan ? 'Phân tích lại' : 'Lập kế hoạch'}
          </Button>
        }
      />

      {req.status === 'idle' && (
        <p className="rounded-2xl bg-cream/70 p-4 text-sm text-ink-soft">
          Bấm “Lập kế hoạch” để AI xem {data.tasks.filter((t) => t.status !== 'completed').length} nhiệm vụ chưa xong và thời gian rảnh của bạn, rồi đề xuất việc cần làm trước, deadline có nguy cơ trễ và cách phân bổ thời gian.
        </p>
      )}
      {req.status === 'loading' && <LoadingBox text={getAiMode() === 'gemini' ? 'AI đang lập kế hoạch…' : 'Đang phân tích…'} />}
      {req.status === 'error' && <ErrorBox error={req.error} onRetry={() => void req.retry()} onUseDemo={() => run('demo')} />}

      {req.status === 'success' && plan && req.result && (
        <div className="anim-fade-up space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SourceBadge source={req.result.source} model={req.result.model} />
            {plan.droppedItems > 0 && (
              <span className="text-[11px] font-semibold text-ink-mute">Đã loại {plan.droppedItems} mục AI nhắc tới nhiệm vụ không tồn tại.</span>
            )}
          </div>
          {plan.summary && (
            <div className="rounded-2xl bg-brand-tint/70 p-4 text-ink-soft">
              <SimpleMarkdown text={plan.summary} />
            </div>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            <Section icon={<Target className="h-4 w-4 text-brand-deep" />} title="Tập trung trước">
              {items(plan.focus, 'Không có nhiệm vụ nào cần làm.')}
            </Section>
            <Section icon={<AlertTriangle className="h-4 w-4 text-danger-fg" />} title="Deadline có nguy cơ trễ" tone="bg-danger-bg/60">
              {items(plan.risks, 'Không có deadline nào có nguy cơ trễ với lịch rảnh hiện tại.')}
            </Section>
            <Section icon={<CalendarRange className="h-4 w-4 text-brand-deep" />} title="Đề xuất phân bổ thời gian">
              {items(plan.allocation, 'Không có đề xuất.')}
            </Section>
            <Section icon={<Lightbulb className="h-4 w-4 text-warn-fg" />} title="Lời khuyên" tone="bg-butter/50">
              <ul className="space-y-1.5 text-xs text-ink-soft">
                {plan.tips.map((t) => (
                  <li key={t}>• {t}</li>
                ))}
              </ul>
            </Section>
          </div>
        </div>
      )}
    </Card>
  );
}
