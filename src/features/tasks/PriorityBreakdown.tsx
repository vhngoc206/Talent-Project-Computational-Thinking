import { PRIORITY_LEVEL_LABEL, WEIGHTS, type PriorityLevel, type PriorityResult } from '../../algorithms/priorityScheduler';
import { Badge, type BadgeTone } from '../../components/ui/Badge';

export const LEVEL_TONE: Record<PriorityLevel, BadgeTone> = {
  critical: 'danger',
  high: 'warn',
  medium: 'info',
  low: 'safe',
};

const fmt = (n: number) => n.toFixed(2);

function Bar({ label, value, weight }: { label: string; value: number; weight: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-bold text-ink">{label}</span>
        <span className="tabular-nums text-ink-soft">
          {value}/3 × {weight}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-brand-tint" aria-hidden>
        <div className="h-full rounded-full bg-brand" style={{ width: `${(value / 3) * 100}%` }} />
      </div>
    </div>
  );
}

/** Giải thích minh bạch điểm ưu tiên: công thức, từng thành phần và lý do. */
export function PriorityBreakdown({ result }: { result: PriorityResult }) {
  const { deadlineScore, importanceScore, difficultyScore, score, level, reasons } = result;
  return (
    <div className="rounded-2xl bg-cream/70 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black tabular-nums">{fmt(score)}</span>
          <span className="text-xs text-ink-mute">/ 3.00 điểm ưu tiên</span>
        </div>
        <Badge tone={LEVEL_TONE[level]}>Mức {PRIORITY_LEVEL_LABEL[level].toLowerCase()}</Badge>
      </div>


      <div className="mb-3 grid gap-2.5 sm:grid-cols-3">
        <Bar label="Deadline" value={deadlineScore} weight={WEIGHTS.deadline} />
        <Bar label="Quan trọng" value={importanceScore} weight={WEIGHTS.importance} />
        <Bar label="Độ khó" value={difficultyScore} weight={WEIGHTS.difficulty} />
      </div>

      <p className="mb-1 text-xs font-extrabold text-ink-soft">Vì sao ưu tiên như vậy?</p>
      <ul className="space-y-1 text-xs text-ink-soft">
        {reasons.map((r) => (
          <li key={r} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}
