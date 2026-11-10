import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import type { TaskStatus } from '../../types';
import type { StatusSlice } from './stats';

// Bộ 3 màu đã qua validate_palette (CVD ΔE ≥ 8, normal ≥ 15); danh tính còn được mã hóa bằng nhãn + số lượng
const COLOR: Record<TaskStatus, string> = {
  completed: '#4f8a4b',
  in_progress: '#d99a3d',
  todo: '#7fa3c4',
};

interface Props {
  slices: StatusSlice[];
  /** % hoàn thành 0–100 */
  rate: number;
}

export function TaskCompletionChart({ slices, rate }: Props) {
  const total = slices.reduce((s, x) => s + x.count, 0);
  const plot = slices.filter((s) => s.count > 0);

  return (
    <Card className="h-full">
      <CardHeader icon={<PieIcon className="h-4 w-4" aria-hidden />} title="Tỷ lệ hoàn thành" subtitle="Theo trạng thái nhiệm vụ" />

      <div className="relative mx-auto h-36 w-36" role="img" aria-label={`Đã hoàn thành ${rate}% trong tổng ${total} nhiệm vụ`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {total === 0 ? (
              <Pie data={[{ v: 1 }]} dataKey="v" innerRadius={48} outerRadius={66} fill="#ecebe4" stroke="none" isAnimationActive={false} />
            ) : (
              <>
                <Pie
                  data={plot}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={48}
                  outerRadius={66}
                  paddingAngle={plot.length > 1 ? 3 : 0}
                  cornerRadius={5}
                  stroke="#fff"
                  strokeWidth={2}
                  startAngle={90}
                  endAngle={-270}
                >
                  {plot.map((s) => (
                    <Cell key={s.status} fill={COLOR[s.status]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [`${value} nhiệm vụ`, name]}
                  contentStyle={{ borderRadius: 12, border: '1px solid #ecebe4', fontSize: 12 }}
                />
              </>
            )}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black tabular-nums">{rate}%</span>
          <span className="text-[11px] text-ink-mute">hoàn thành</span>
        </div>
      </div>

      <ul className="mt-3 space-y-1.5 text-sm">
        {slices.map((s) => (
          <li key={s.status} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-ink-soft">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLOR[s.status] }} aria-hidden />
              {s.label}
            </span>
            <span className="font-extrabold tabular-nums">{s.count}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
