import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { formatMinutes } from '../../utils/date';
import type { WeekPerformance } from './stats';

const INK_SOFT = '#545b55';

interface TipProps {
  active?: boolean;
  payload?: Array<{ payload: WeekPerformance }>;
}

function Tip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const w = payload[0].payload;
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-xs shadow-pop ring-1 ring-line">
      <p className="font-extrabold">
        Tuần {w.label}
        {w.isCurrent && ' (tuần này)'}
      </p>
      <p className="text-ink-soft">Học: {formatMinutes(w.minutes)}</p>
      <p className="text-ink-soft">Hoàn thành: {w.completedTasks} nhiệm vụ</p>
    </div>
  );
}

/** Hiệu suất học tập theo tuần: cột = giờ học, đường = số nhiệm vụ hoàn thành. */
export function WeeklyPerformanceChart({ data }: { data: WeekPerformance[] }) {
  const chartData = data.map((w) => ({
    ...w,
    hours: Math.round((w.minutes / 60) * 10) / 10,
    shortLabel: w.isCurrent ? 'Tuần này' : w.label.split('–')[0],
  }));
  const current = data[data.length - 1];
  const previous = data[data.length - 2];
  const delta = previous ? current.minutes - previous.minutes : 0;

  return (
    <Card className="h-full">
      <CardHeader
        icon={<TrendingUp className="h-4 w-4" aria-hidden />}
        title="Hiệu suất theo tuần"
        subtitle={`${data.length} tuần gần nhất (thứ hai – chủ nhật)`}
        action={
          previous ? (
            <div className="text-right">
              <p className={`text-sm font-black tabular-nums ${delta >= 0 ? 'text-safe-fg' : 'text-danger-fg'}`}>
                {delta >= 0 ? '+' : '−'}
                {formatMinutes(Math.abs(delta))}
              </p>
              <p className="text-[11px] text-ink-mute">so với tuần trước</p>
            </div>
          ) : undefined
        }
      />
      <div className="h-52" role="img" aria-label="Biểu đồ giờ học và số nhiệm vụ hoàn thành theo tuần">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 6, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#ecebe4" strokeDasharray="3 4" />
            {/* Nhãn trục chỉ ghi ngày đầu tuần cho gọn; khoảng đầy đủ nằm trong tooltip */}
            <XAxis dataKey="shortLabel" tickLine={false} axisLine={false} tick={{ fill: INK_SOFT, fontSize: 11, fontWeight: 700 }} interval={0} />
            <YAxis yAxisId="h" tickLine={false} axisLine={false} width={44} tick={{ fill: INK_SOFT, fontSize: 11 }} tickFormatter={(v: number) => `${v}h`} />
            <YAxis yAxisId="t" orientation="right" tickLine={false} axisLine={false} width={28} allowDecimals={false} tick={{ fill: '#4f8a4b', fontSize: 11 }} />
            <Tooltip cursor={{ fill: 'rgba(255,153,94,0.10)' }} content={<Tip />} />
            <Bar yAxisId="h" dataKey="hours" radius={[8, 8, 0, 0]} maxBarSize={34}>
              {chartData.map((w) => (
                <Cell key={w.weekStart} fill={w.isCurrent ? '#d99a3d' : '#c9dfb8'} />
              ))}
            </Bar>
            <Line yAxisId="t" type="linear" dataKey="completedTasks" stroke="#4f8a4b" strokeWidth={2.5} dot={{ r: 3.5, fill: '#4f8a4b' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs font-bold text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-[#c9dfb8]" aria-hidden /> Giờ học
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-[#4f8a4b]" aria-hidden /> Nhiệm vụ hoàn thành
        </span>
      </div>
    </Card>
  );
}
