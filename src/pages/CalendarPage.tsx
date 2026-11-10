/**
 * LỊCH (kiểu Google Calendar): xem theo Ngày / Tuần / Tháng, bấm vào ô trống để tạo sự kiện có giờ,
 * bấm vào sự kiện để sửa/xóa. Lịch hiển thị chung:
 *   - Sự kiện của bạn (lặp lại hằng ngày/tuần được),
 *   - Phiên học do Greedy Scheduler xếp (nét đứt, màu môn học),
 *   - Deadline nhiệm vụ (dòng "cả ngày").
 */
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { Button, IconButton } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { WEEKDAY_LONG, WEEKDAY_SHORT } from '../constants';
import { EventFormModal } from '../features/calendar/EventFormModal';
import { routeHref } from '../hooks/useHashRoute';
import { useNow } from '../hooks/useNow';
import { useAppState } from '../state/AppStateContext';
import type { CalendarEvent, CalendarEventInput } from '../types';
import { cn } from '../utils/cn';
import { addDays, startOfDay, toDateKey } from '../utils/date';
import { dateAt, expandEvents, layoutOverlaps } from '../utils/events';

type View = 'day' | 'week' | 'month';
const HOUR_PX = 44;
const MONTHS = ['tháng 1', 'tháng 2', 'tháng 3', 'tháng 4', 'tháng 5', 'tháng 6', 'tháng 7', 'tháng 8', 'tháng 9', 'tháng 10', 'tháng 11', 'tháng 12'];
const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Thứ Hai đầu tuần chứa `d` (tuần ở Việt Nam bắt đầu từ thứ Hai) */
function mondayOf(d: Date): Date {
  const s = startOfDay(d);
  return addDays(s, -((s.getDay() + 6) % 7));
}

interface CalItem {
  key: string;
  kind: 'event' | 'study' | 'deadline';
  title: string;
  color: string;
  date: string;
  startMs: number;
  endMs: number;
  allDay: boolean;
  location?: string;
  completed?: boolean;
  event?: CalendarEvent;
}

type Editing = { event: CalendarEvent | null; initial: Partial<CalendarEventInput> } | null;

export function CalendarPage() {
  const { data, actions } = useAppState();
  const toast = useToast();
  const now = useNow(60_000);
  const [view, setView] = useState<View>(() => (window.innerWidth < 640 ? 'day' : 'week'));
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [editing, setEditing] = useState<Editing>(null);
  const [confirmDelete, setConfirmDelete] = useState<CalendarEvent | null>(null);

  // Khoảng ngày đang hiển thị
  const days = useMemo(() => {
    if (view === 'day') return [cursor];
    if (view === 'week') return Array.from({ length: 7 }, (_, i) => addDays(mondayOf(cursor), i));
    const first = mondayOf(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
    return Array.from({ length: 42 }, (_, i) => addDays(first, i));
  }, [view, cursor]);

  // Gom mọi thứ cần vẽ trong khoảng ngày đó
  const items = useMemo<CalItem[]>(() => {
    const from = days[0];
    const to = days[days.length - 1];
    const fromKey = toDateKey(from);
    const toKey = toDateKey(to);
    const out: CalItem[] = expandEvents(data.events, from, to).map((o) => ({
      key: `${o.event.id}@${o.date}`,
      kind: 'event',
      title: o.event.title,
      color: o.event.color,
      date: o.date,
      startMs: o.startMs,
      endMs: o.endMs,
      allDay: o.event.allDay,
      location: o.event.location,
      event: o.event,
    }));
    const taskById = new Map(data.tasks.map((t) => [t.id, t]));
    const subjectById = new Map(data.subjects.map((s) => [s.id, s]));
    for (const s of data.schedule?.sessions ?? []) {
      if (!s.startTime || !s.endTime || s.date < fromKey || s.date > toKey) continue;
      const task = taskById.get(s.taskId);
      out.push({
        key: `ses-${s.id}`,
        kind: 'study',
        title: `📖 ${task?.title ?? 'Phiên học'}`,
        color: subjectById.get(s.subjectId)?.color ?? '#7FAE6A',
        date: s.date,
        startMs: dateAt(s.date, s.startTime).getTime(),
        endMs: dateAt(s.date, s.endTime).getTime(),
        allDay: false,
        completed: s.completed,
      });
    }
    for (const t of data.tasks) {
      const d = new Date(t.deadline);
      const key = toDateKey(d);
      if (key < fromKey || key > toKey) continue;
      out.push({
        key: `dl-${t.id}`,
        kind: 'deadline',
        title: `⏰ ${hhmm(d.getTime())} ${t.title}`,
        color: subjectById.get(t.subjectId)?.color ?? '#C9822B',
        date: key,
        startMs: d.getTime(),
        endMs: d.getTime(),
        allDay: true,
        completed: t.status === 'completed',
      });
    }
    return out;
  }, [days, data.events, data.schedule, data.tasks, data.subjects]);

  const byDate = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    for (const it of items) map.set(it.date, [...(map.get(it.date) ?? []), it]);
    return map;
  }, [items]);

  function move(dir: -1 | 1) {
    if (view === 'day') setCursor((c) => addDays(c, dir));
    else if (view === 'week') setCursor((c) => addDays(c, dir * 7));
    else setCursor((c) => new Date(c.getFullYear(), c.getMonth() + dir, 1));
  }

  const title =
    view === 'month'
      ? `Tháng ${cursor.getMonth() + 1}, ${cursor.getFullYear()}`
      : view === 'day'
        ? `${WEEKDAY_LONG[cursor.getDay()]}, ${pad(cursor.getDate())}/${pad(cursor.getMonth() + 1)}/${cursor.getFullYear()}`
        : (() => {
            const a = days[0];
            const b = days[6];
            return a.getMonth() === b.getMonth()
              ? `${a.getDate()} – ${b.getDate()} ${MONTHS[b.getMonth()]}, ${b.getFullYear()}`
              : `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]}, ${b.getFullYear()}`;
          })();

  function openCreate(date: string, startTime = '09:00') {
    const [h, m] = startTime.split(':').map(Number);
    const endMin = Math.min(23 * 60 + 59, h * 60 + m + 60);
    setEditing({ event: null, initial: { date, startTime, endTime: `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}` } });
  }

  function openItem(it: CalItem) {
    if (it.kind === 'event' && it.event) setEditing({ event: it.event, initial: {} });
    else if (it.kind === 'study') window.location.hash = routeHref('scheduler');
    else window.location.hash = routeHref('tasks');
  }

  function save(input: CalendarEventInput) {
    if (editing?.event) {
      actions.updateEvent(editing.event.id, input);
      toast('Đã lưu sự kiện.');
    } else {
      actions.addEvent(input);
      toast(input.blocksStudy ? 'Đã thêm sự kiện – lịch học sẽ tránh khung giờ này khi tạo lại.' : 'Đã thêm sự kiện.');
    }
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      {/* Thanh công cụ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Button size="sm" onClick={() => setCursor(startOfDay(new Date()))}>
            Hôm nay
          </Button>
          <IconButton label="Trước" onClick={() => move(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </IconButton>
          <IconButton label="Sau" onClick={() => move(1)}>
            <ChevronRight className="h-4 w-4" />
          </IconButton>
          <h2 className="ml-1 text-base font-extrabold sm:text-lg">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-cream p-0.5" role="tablist" aria-label="Chế độ xem">
            {(['day', 'week', 'month'] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn('rounded-md px-3 py-1 text-xs font-extrabold', view === v ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink')}
              >
                {v === 'day' ? 'Ngày' : v === 'week' ? 'Tuần' : 'Tháng'}
              </button>
            ))}
          </div>
          <Button size="sm" variant="primary" icon={<CalendarPlus className="h-4 w-4" />} onClick={() => openCreate(toDateKey(view === 'day' ? cursor : now > days[0] && now < addDays(days[days.length - 1], 1) ? now : days[0]), '09:00')}>
            Tạo
          </Button>
        </div>
      </div>

      <Legend />

      {view === 'month' ? (
        <MonthGrid
          days={days}
          month={cursor.getMonth()}
          byDate={byDate}
          now={now}
          onCreate={(d) => openCreate(d)}
          onOpen={openItem}
          onShowDay={(d) => {
            setCursor(d);
            setView('day');
          }}
        />
      ) : (
        <TimeGrid days={days} byDate={byDate} now={now} onCreate={openCreate} onOpen={openItem} />
      )}

      {editing && (
        <EventFormModal
          event={editing.event}
          initial={editing.initial}
          onSubmit={save}
          onDelete={editing.event ? () => setConfirmDelete(editing.event) : undefined}
          onClose={() => setEditing(null)}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Xóa sự kiện?"
          message={`“${confirmDelete.title}”${confirmDelete.repeat !== 'none' ? ' và mọi lần lặp lại' : ''} sẽ bị xóa khỏi lịch.`}
          confirmLabel="Xóa"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            actions.deleteEvent(confirmDelete.id);
            setConfirmDelete(null);
            setEditing(null);
            toast('Đã xóa sự kiện.');
          }}
        />
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-ink-mute">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-[#5B8C5A]" /> Sự kiện của bạn
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-ink-mute" /> Giờ học tự động
      </span>
      <span className="flex items-center gap-1.5">⏰ Deadline nhiệm vụ</span>
      <span className="hidden sm:inline">· Bấm vào ô trống để tạo sự kiện</span>
    </div>
  );
}

function Chip({ it, onOpen, compact }: { it: CalItem; onOpen: (it: CalItem) => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(it);
      }}
      className={cn(
        'block w-full truncate rounded px-1.5 text-left text-[11px] font-bold leading-5',
        it.kind === 'event' ? 'text-white' : 'border border-dashed text-ink',
        it.completed && 'line-through opacity-60',
        compact && 'leading-[18px]',
      )}
      style={it.kind === 'event' ? { backgroundColor: it.color } : { borderColor: it.color, backgroundColor: `${it.color}22` }}
      title={it.title}
    >
      {it.kind === 'event' && !it.allDay && <span className="mr-1 font-semibold opacity-90">{hhmm(it.startMs)}</span>}
      {it.title}
    </button>
  );
}

// ───────────────────────── Xem theo Ngày / Tuần ─────────────────────────
function TimeGrid({
  days,
  byDate,
  now,
  onCreate,
  onOpen,
}: {
  days: Date[];
  byDate: Map<string, CalItem[]>;
  now: Date;
  onCreate: (date: string, time: string) => void;
  onOpen: (it: CalItem) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayKey = toDateKey(now);

  // Mở lịch ở khoảng 7 giờ sáng
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_PX - 8;
  }, []);

  function clickSlot(e: MouseEvent<HTMLDivElement>, date: string) {
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = Math.max(0, Math.min(23 * 60 + 30, Math.floor(((e.clientY - rect.top) / HOUR_PX) * 2) * 30));
    onCreate(date, `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`);
  }

  const cols = { gridTemplateColumns: `3rem repeat(${days.length}, minmax(0, 1fr))` };
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-soft">
      {/* Tiêu đề ngày */}
      <div className="grid border-b border-line" style={cols}>
        <div />
        {days.map((d) => {
          const key = toDateKey(d);
          const isToday = key === todayKey;
          return (
            <div key={key} className="border-l border-line px-1 py-2 text-center">
              <p className={cn('text-[11px] font-bold uppercase', isToday ? 'text-brand-deep' : 'text-ink-mute')}>{WEEKDAY_SHORT[d.getDay()]}</p>
              <p className={cn('mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-base font-black', isToday && 'bg-brand-deep text-white')}>{d.getDate()}</p>
            </div>
          );
        })}
      </div>

      {/* Dòng cả ngày: sự kiện cả ngày + deadline */}
      <div className="grid border-b border-line" style={cols}>
        <div className="py-1.5 pr-1 text-right text-[10px] font-bold text-ink-mute">cả ngày</div>
        {days.map((d) => {
          const key = toDateKey(d);
          const list = (byDate.get(key) ?? []).filter((it) => it.allDay);
          return (
            <div key={key} className="min-h-[30px] space-y-0.5 border-l border-line p-0.5">
              {list.map((it) => (
                <Chip key={it.key} it={it} onOpen={onOpen} compact />
              ))}
            </div>
          );
        })}
      </div>

      {/* Lưới giờ */}
      <div ref={scrollRef} className="max-h-[62vh] overflow-y-auto">
        <div className="relative grid" style={cols}>
          <div>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="relative text-right" style={{ height: HOUR_PX }}>
                {h > 0 && <span className="absolute -top-2 right-1.5 text-[10px] font-semibold text-ink-mute">{pad(h)}:00</span>}
              </div>
            ))}
          </div>
          {days.map((d) => {
            const key = toDateKey(d);
            const dayStart = startOfDay(d).getTime();
            const timed = layoutOverlaps((byDate.get(key) ?? []).filter((it) => !it.allDay));
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                className={cn('relative cursor-pointer border-l border-line', isToday && 'bg-brand-tint/30')}
                style={{ height: HOUR_PX * 24 }}
                onClick={(e) => clickSlot(e, key)}
                role="presentation"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="border-t border-line/70" style={{ height: HOUR_PX }} />
                ))}
                {timed.map((it) => {
                  const top = ((it.startMs - dayStart) / 60_000) * (HOUR_PX / 60);
                  const height = Math.max(20, ((it.endMs - it.startMs) / 60_000) * (HOUR_PX / 60) - 2);
                  const isEvent = it.kind === 'event';
                  return (
                    <button
                      key={it.key}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(it);
                      }}
                      className={cn(
                        'absolute overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm transition hover:z-10 hover:brightness-95',
                        isEvent ? 'text-white' : 'border border-dashed text-ink',
                        it.completed && 'opacity-60',
                      )}
                      style={{
                        top,
                        height,
                        left: `calc(${(it.col / it.cols) * 100}% + 2px)`,
                        width: `calc(${100 / it.cols}% - 4px)`,
                        ...(isEvent ? { backgroundColor: it.color } : { borderColor: it.color, backgroundColor: `${it.color}2a` }),
                      }}
                      title={`${it.title} · ${hhmm(it.startMs)}–${hhmm(it.endMs)}`}
                    >
                      <span className={cn('block truncate font-extrabold', it.completed && 'line-through')}>{it.title}</span>
                      {height > 30 && (
                        <span className="block truncate opacity-90">
                          {hhmm(it.startMs)} – {hhmm(it.endMs)}
                        </span>
                      )}
                      {height > 48 && it.location && (
                        <span className="flex items-center gap-0.5 truncate opacity-90">
                          <MapPin className="h-2.5 w-2.5 shrink-0" aria-hidden />
                          {it.location}
                        </span>
                      )}
                    </button>
                  );
                })}
                {isToday && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: ((now.getTime() - dayStart) / 60_000) * (HOUR_PX / 60) }}>
                    <span className="-ml-1 h-2.5 w-2.5 rounded-full bg-danger-fg" />
                    <span className="h-0.5 flex-1 bg-danger-fg" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Xem theo Tháng ─────────────────────────
function MonthGrid({
  days,
  month,
  byDate,
  now,
  onCreate,
  onOpen,
  onShowDay,
}: {
  days: Date[];
  month: number;
  byDate: Map<string, CalItem[]>;
  now: Date;
  onCreate: (date: string) => void;
  onOpen: (it: CalItem) => void;
  onShowDay: (d: Date) => void;
}) {
  const todayKey = toDateKey(now);
  const MAX = 3;
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-soft">
      <div className="grid grid-cols-7 border-b border-line">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <p key={d} className="py-2 text-center text-[11px] font-bold uppercase text-ink-mute">
            {WEEKDAY_SHORT[d]}
          </p>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const key = toDateKey(d);
          const list = (byDate.get(key) ?? []).sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startMs - b.startMs);
          const inMonth = d.getMonth() === month;
          return (
            <div
              key={key}
              onClick={() => onCreate(key)}
              role="presentation"
              className={cn('min-h-[92px] cursor-pointer border-b border-l border-line p-1 first:border-l-0 sm:min-h-[110px]', !inMonth && 'bg-cream/60')}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onShowDay(d);
                }}
                className={cn(
                  'mb-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-extrabold hover:bg-black/5',
                  key === todayKey ? 'bg-brand-deep text-white hover:bg-brand-deep' : inMonth ? 'text-ink' : 'text-ink-mute',
                )}
                aria-label={`Xem ngày ${d.getDate()}/${d.getMonth() + 1}`}
              >
                {d.getDate()}
              </button>
              <div className="space-y-0.5">
                {list.slice(0, MAX).map((it) => (
                  <Chip key={it.key} it={it} onOpen={onOpen} compact />
                ))}
                {list.length > MAX && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowDay(d);
                    }}
                    className="px-1 text-[11px] font-extrabold text-ink-soft hover:underline"
                  >
                    +{list.length - MAX} mục khác
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
