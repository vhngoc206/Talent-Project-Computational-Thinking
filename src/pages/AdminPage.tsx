/** Trang Quản trị (chỉ tài khoản admin): người dùng và lượt truy cập. */
import { useEffect, useMemo, useState } from 'react';
import { Activity, CalendarCheck, Loader2, RefreshCw, UserPlus, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { fetchUsers, fetchVisits, type UserRow, type VisitRow } from '../services/cloudStore';
import { addDays, startOfDay, toDateKey } from '../utils/date';

const pad = (n: number) => String(n).padStart(2, '0');
const fmtDateTime = (d: Date | null) => (d ? `${pad(d.getHours())}:${pad(d.getMinutes())} · ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '—');

function Tile({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-soft">
      <Icon className="mb-2 h-4 w-4 text-brand-deep" aria-hidden />
      <p className="text-2xl font-black tabular-nums">{value}</p>
      <p className="text-xs font-bold text-ink-soft">{label}</p>
    </div>
  );
}

export function AdminPage() {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error' } | { status: 'ok'; visits: VisitRow[]; users: UserRow[] }>({ status: 'loading' });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setState({ status: 'loading' });
    Promise.all([fetchVisits(), fetchUsers()])
      .then(([visits, users]) => setState({ status: 'ok', visits, users }))
      .catch(() => setState({ status: 'error' }));
  }, [reload]);

  const stats = useMemo(() => {
    if (state.status !== 'ok') return null;
    const today = startOfDay(new Date());
    const weekAgo = addDays(today, -6);
    const visitsToday = state.visits.filter((v) => v.at >= today);
    const visitsWeek = state.visits.filter((v) => v.at >= weekAgo);
    // Lượt truy cập 14 ngày gần nhất
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
    const chart = days.map((d) => {
      const key = toDateKey(d);
      const list = state.visits.filter((v) => toDateKey(v.at) === key);
      return { label: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`, visits: list.length, people: new Set(list.map((v) => v.uid)).size };
    });
    return {
      totalUsers: state.users.length,
      visitsToday: visitsToday.length,
      activeWeek: new Set(visitsWeek.map((v) => v.uid)).size,
      newWeek: state.users.filter((u) => u.createdAt && u.createdAt >= weekAgo).length,
      chart,
      users: [...state.users].sort((a, b) => (b.lastSeenAt?.getTime() ?? 0) - (a.lastSeenAt?.getTime() ?? 0)),
    };
  }, [state]);

  if (state.status === 'loading')
    return (
      <p className="flex items-center gap-2 text-sm text-ink-soft">
        <Loader2 className="h-4 w-4 animate-spin" /> Đang tải thống kê…
      </p>
    );
  if (state.status === 'error' || !stats)
    return (
      <Card>
        <p className="text-sm text-danger-fg">Không tải được thống kê. Hãy chắc chắn bạn đăng nhập bằng tài khoản quản trị đã xác minh email.</p>
        <Button className="mt-3" size="sm" onClick={() => setReload((r) => r + 1)}>
          Thử lại
        </Button>
      </Card>
    );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => setReload((r) => r + 1)}>
          Làm mới
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Users} label="Người dùng" value={stats.totalUsers} />
        <Tile icon={Activity} label="Lượt truy cập hôm nay" value={stats.visitsToday} />
        <Tile icon={CalendarCheck} label="Người hoạt động 7 ngày" value={stats.activeWeek} />
        <Tile icon={UserPlus} label="Người mới 7 ngày" value={stats.newWeek} />
      </div>

      <Card>
        <CardHeader title="Lượt truy cập 14 ngày gần nhất" subtitle="Mỗi lần mở web là một lượt" />
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.chart} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#ecebe4" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6c736b' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6c736b' }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: '#ecf4e4' }} formatter={(v, n) => [v, n === 'visits' ? 'Lượt truy cập' : 'Số người']} />
              <Bar dataKey="visits" fill="#7fae6a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="people" fill="#6e9fc9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 flex gap-4 text-[11px] font-semibold text-ink-mute">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#7fae6a]" /> Lượt truy cập
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#6e9fc9]" /> Số người
          </span>
        </p>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader title={`Người dùng (${stats.users.length})`} />
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead className="text-ink-mute">
                <tr>
                  <th className="px-5 py-2 font-bold">Người dùng</th>
                  <th className="py-2 font-bold">Đăng nhập bằng</th>
                  <th className="py-2 font-bold">Lần cuối</th>
                  <th className="px-5 py-2 text-right font-bold">Lượt</th>
                </tr>
              </thead>
              <tbody>
                {stats.users.map((u) => (
                  <tr key={u.uid} className="border-t border-line">
                    <td className="px-5 py-2">
                      <span className="block font-bold text-ink">{u.name}</span>
                      <span className="text-ink-mute">{u.email}</span>
                    </td>
                    <td className="py-2">{u.provider === 'google' ? 'Google' : 'Email'}</td>
                    <td className="py-2 tabular-nums">{fmtDateTime(u.lastSeenAt)}</td>
                    <td className="px-5 py-2 text-right font-bold tabular-nums">{u.visitCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Truy cập gần đây" />
          <div className="-mx-5 max-h-[420px] overflow-auto">
            <table className="w-full min-w-[420px] text-left text-xs">
              <thead className="sticky top-0 bg-white text-ink-mute">
                <tr>
                  <th className="px-5 py-2 font-bold">Thời gian</th>
                  <th className="py-2 font-bold">Người dùng</th>
                  <th className="px-5 py-2 font-bold">Thiết bị</th>
                </tr>
              </thead>
              <tbody>
                {state.visits.slice(0, 100).map((v) => (
                  <tr key={v.id} className="border-t border-line">
                    <td className="whitespace-nowrap px-5 py-2 tabular-nums">{fmtDateTime(v.at)}</td>
                    <td className="py-2">
                      <span className="block font-bold text-ink">{v.name}</span>
                      <span className="text-ink-mute">{v.email}</span>
                    </td>
                    <td className="px-5 py-2 text-ink-soft">{v.device}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
