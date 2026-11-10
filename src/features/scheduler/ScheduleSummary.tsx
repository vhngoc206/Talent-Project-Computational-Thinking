import { AlertTriangle, CircleSlash, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { Badge, ProgressBar } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import type { StudySchedule, Task } from '../../types';
import { formatDeadline, formatMinutes } from '../../utils/date';

interface Props {
  schedule: StudySchedule;
  tasks: Task[];
  stale: boolean;
  onRegenerate: () => void;
  onClear: () => void;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-cream/80 px-3 py-2.5">
      <p className="text-lg font-black leading-tight tabular-nums">{value}</p>
      <p className="text-[11px] font-bold text-ink-mute">{label}</p>
    </div>
  );
}

/** Tóm tắt kết quả lập lịch: số liệu, cảnh báo thiếu thời gian, task chưa được phân bổ. */
export function ScheduleSummary({ schedule, tasks, stale, onRegenerate, onClear }: Props) {
  const { stats } = schedule;
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const coverage = stats.requiredMinutes === 0 ? 100 : Math.round((stats.scheduledMinutes / stats.requiredMinutes) * 100);
  const doneMinutes = schedule.sessions.filter((s) => s.completed).reduce((s, x) => s + x.minutes, 0);

  return (
    <Card>
      <CardHeader
        icon={<Sparkles className="h-4 w-4" aria-hidden />}
        title="Lịch học của bạn"
        subtitle={`Tạo lúc ${formatDeadline(schedule.generatedAt)} · xét ${stats.horizonDays} ngày tới`}
        action={
          <div className="flex gap-1.5">
            <Button size="sm" variant={stale ? 'primary' : 'secondary'} icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={onRegenerate}>
              Tạo lại lịch
            </Button>
            <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={onClear} aria-label="Xóa lịch">
              <span className="hidden sm:inline">Xóa</span>
            </Button>
          </div>
        }
      />

      {stale && (
        <p className="mb-3 flex items-start gap-2 rounded-xl bg-warn-bg px-3 py-2 text-xs font-semibold text-warn-fg" role="status">
          <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Nhiệm vụ hoặc thời gian rảnh đã thay đổi kể từ lần tạo lịch này. Nhấn “Tạo lại lịch” để cập nhật.
        </p>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Phiên học" value={String(schedule.sessions.length)} />
        <Stat label="Đã xếp lịch" value={formatMinutes(stats.scheduledMinutes)} />
        <Stat label="Cần học" value={formatMinutes(stats.requiredMinutes)} />
        <Stat label="Thời gian rảnh" value={formatMinutes(stats.capacityMinutes)} />
      </div>

      <div className="mb-1 flex justify-between text-xs font-bold text-ink-soft">
        <span>Đã phân bổ {Math.min(100, coverage)}% khối lượng cần học</span>
        {doneMinutes > 0 && <span>Đã học theo lịch: {formatMinutes(doneMinutes)}</span>}
      </div>
      <ProgressBar value={coverage} label="Tỷ lệ khối lượng đã được xếp lịch" />

      {schedule.warnings.length > 0 && (
        <ul className="mt-4 space-y-1.5" aria-label="Cảnh báo">
          {schedule.warnings.map((w) => (
            <li key={w} className="flex items-start gap-2 rounded-xl bg-danger-bg px-3 py-2 text-xs font-semibold text-danger-fg">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {w}
            </li>
          ))}
        </ul>
      )}

      {schedule.unscheduled.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-extrabold text-ink-soft">Nhiệm vụ chưa được phân bổ đủ</p>
          <ul className="space-y-1.5">
            {schedule.unscheduled.map((u) => {
              const t = taskById.get(u.taskId);
              return (
                <li key={u.taskId} className="flex items-start gap-2 rounded-xl border border-line px-3 py-2 text-xs">
                  <CircleSlash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger-fg" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-ink">{t?.title ?? '—'}</p>
                    <p className="text-ink-soft">{u.reason}</p>
                  </div>
                  <Badge tone="danger" className="tabular-nums">
                    −{formatMinutes(u.missingMinutes)}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {schedule.warnings.length === 0 && schedule.unscheduled.length === 0 && (
        <p className="mt-4 rounded-xl bg-safe-bg px-3 py-2 text-xs font-semibold text-safe-fg">
          Tất cả nhiệm vụ đều được xếp đủ thời gian trước deadline.
        </p>
      )}
    </Card>
  );
}
