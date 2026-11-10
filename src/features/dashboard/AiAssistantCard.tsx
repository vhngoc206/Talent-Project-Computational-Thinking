import { Sparkles } from 'lucide-react';
import { PRIORITY_LEVEL_LABEL, type PriorityResult } from '../../algorithms/priorityScheduler';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader } from '../../components/ui/Card';
import { routeHref } from '../../hooks/useHashRoute';
import type { Subject } from '../../types';
import { formatMinutes } from '../../utils/date';
import { LEVEL_TONE } from '../tasks/PriorityBreakdown';

interface Props {
  top: PriorityResult | undefined;
  subjects: Subject[];
  /** Tổng số phút còn phải học cho các task trong 7 ngày tới (ước tính − đã học) */
  remainingMinutesThisWeek: number;
}

/**
 * Thẻ AI trên Dashboard.
 * Gợi ý trong thẻ do Priority Engine tính (không gọi AI để Dashboard tải nhanh, không tốn quota);
 * nhãn cho biết trang AI Assistant đang chạy Gemini thật hay Demo Mode.
 */
export function AiAssistantCard({ top, subjects, remainingMinutesThisWeek }: Props) {
  const subject = top ? subjects.find((s) => s.id === top.task.subjectId) : undefined;

  return (
    <Card className="h-full">
      <CardHeader
        icon={<Sparkles className="h-4 w-4" aria-hidden />}
        title="Gợi ý cho bạn"
        subtitle="Việc nên làm trước tiên"
      />

      {top ? (
        <div className="space-y-3">
          <div className="rounded-2xl bg-gradient-to-br from-brand-tint to-cream p-4">
            <p className="text-xs font-extrabold text-ink-soft">Nên bắt đầu với</p>
            <p className="mt-0.5 text-base font-black leading-snug">{top.task.title}</p>
            <p className="mt-0.5 text-xs text-ink-mute">{subject ? `${subject.code} · ${subject.name}` : ''}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={LEVEL_TONE[top.level]} className="tabular-nums">
                Ưu tiên {PRIORITY_LEVEL_LABEL[top.level].toLowerCase()} · {top.score.toFixed(2)}
              </Badge>
            </div>
            <ul className="mt-2 space-y-0.5 text-xs text-ink-soft">
              {top.reasons.slice(0, 2).map((r) => (
                <li key={r}>• {r}</li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-ink-soft">
            Khối lượng còn lại cho các deadline trong 7 ngày tới: <strong className="text-ink">{formatMinutes(remainingMinutesThisWeek)}</strong>.
          </p>
        </div>
      ) : (
        <p className="rounded-2xl bg-cream/70 p-4 text-sm text-ink-soft">Chưa có nhiệm vụ nào cần làm để gợi ý.</p>
      )}

      <a href={routeHref('ai')} className="mt-3 inline-block text-xs font-extrabold text-brand-deep hover:underline">
        Hỏi trợ lý AI →
      </a>
    </Card>
  );
}
