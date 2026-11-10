import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { formatMinutes } from '../../utils/date';
import type { DayStudy } from './stats';

const BAR = '#7fae6a';
const BAR_TODAY = '#d99a3d';
const INK_SOFT = '#545b55';

interface TipProps {
  active?: boolean;
  payload?: Array<{ payload: DayStudy }>;
}

function ChartTooltip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-xs shadow-pop ring-1 ring-line">
      <p className="font-extrabold">
        {d.label} · {d.dateKey.split('-').reverse().slice(0, 2).join('/')}
        {d.isToday && ' (hôm nay)'}
      </p>
      <p className="text-ink-soft">{d.minutes === 0 ? 'Chưa học' : formatMinutes(d.minutes)}</p>
    </div>
  );
}

/** Biểu đồ giờ học 7 ngày gần nhất – dữ liệu tính từ các phiên học thực tế. */
export function WeeklyStudyChart({ data }: { data: DayStudy[] }) {
  const total = data.reduce((s, d) => s + d.minutes, 0);
  const chartData = data.map((d) => ({ ...d, hours: Math.round((d.minutes / 60) * 100) / 100 }));

  return (
    <Card className="h-full">
      <CardHeader
        icon={<BarChart3 className="h-4 w-4" aria-hidden />}
        title="Giờ học trong tuần"
        subtitle="7 ngày gần nhất"
        action={
          <div className="text-right">
            <p className="text-lg font-black leading-none tabular-nums">{formatMinutes(total)}</p>
            <p className="text-[11px] text-ink-mute">tổng cộng</p>
          </div>
        }
      />
      <div className="h-44" role="img" aria-label={`Biểu đồ cột giờ học 7 ngày gần nhất, tổng ${formatMinutes(total)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 6, right: 4, left: -22, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="#ecebe4" strokeDasharray="3 4" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: INK_SOFT, fontSize: 12, fontWeight: 700 }} />
            <YAxis tickLine={false} axisLine={false} width={44} tick={{ fill: INK_SOFT, fontSize: 11 }} tickFormatter={(v: number) => `${v}h`} allowDecimals={false} />
            <Tooltip cursor={{ fill: 'rgba(255,153,94,0.10)' }} content={<ChartTooltip />} />
            <Bar dataKey="hours" radius={[8, 8, 0, 0]} maxBarSize={30} stroke="#fff" strokeWidth={0}>
              {chartData.map((d) => (
                <Cell key={d.dateKey} fill={d.isToday ? BAR_TODAY : BAR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-2 text-xs text-ink-soft">
        <summary className="cursor-pointer font-bold hover:text-ink">Xem dạng bảng</summary>
        <table className="mt-2 w-full text-left">
          <caption className="sr-only">Thời gian học theo ngày</caption>
          <thead>
            <tr className="text-ink-mute">
              <th className="py-1 font-bold">Ngày</th>
              <th className="py-1 text-right font-bold">Thời gian học</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.dateKey} className="border-t border-line">
                <td className="py-1">
                  {d.label} {d.dateKey.split('-').reverse().slice(0, 2).join('/')}
                </td>
                <td className="py-1 text-right tabular-nums">{formatMinutes(d.minutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Card>
  );
}
