import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { BookOpen } from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { formatMinutes } from '../../utils/date';
import type { SubjectStudy } from './stats';

/** Subject Distribution – phân bố thời gian học thực tế theo môn. */
export function SubjectDistributionChart({ data }: { data: SubjectStudy[] }) {
  const total = data.reduce((s, d) => s + d.minutes, 0);
  const plot = data.filter((d) => d.minutes > 0);

  return (
    <Card className="h-full">
      <CardHeader icon={<BookOpen className="h-4 w-4" aria-hidden />} title="Phân bố theo môn" subtitle="Thời gian học thực tế của từng môn" />
      {total === 0 ? (
        <p className="rounded-2xl bg-cream/70 p-4 text-sm text-ink-soft">Chưa có giờ học nào được ghi nhận.</p>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="h-40 w-40 shrink-0" role="img" aria-label={`Biểu đồ tròn phân bố ${formatMinutes(total)} học theo môn`}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={plot} dataKey="minutes" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={plot.length > 1 ? 2 : 0} stroke="#fff" strokeWidth={2}>
                  {plot.map((d) => (
                    <Cell key={d.subjectId} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [formatMinutes(value), name]}
                  contentStyle={{ borderRadius: 12, border: '1px solid #ecebe4', fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="w-full min-w-0 flex-1 space-y-1.5 text-sm">
            {data.map((d) => (
              <li key={d.subjectId} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-ink-soft">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: d.color }} aria-hidden />
                  <span className="truncate" title={d.name}>
                    {d.name}
                  </span>
                </span>
                <span className="shrink-0 font-extrabold tabular-nums">
                  {formatMinutes(d.minutes)} <span className="text-xs font-bold text-ink-mute">({total ? Math.round((d.minutes / total) * 100) : 0}%)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
