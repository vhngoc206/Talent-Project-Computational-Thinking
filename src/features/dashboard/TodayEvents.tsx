import { useMemo } from 'react';
import { CalendarDays, MapPin } from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { routeHref } from '../../hooks/useHashRoute';
import { useAppState } from '../../state/AppStateContext';
import { formatTime } from '../../utils/date';
import { expandEvents } from '../../utils/events';

/** Sự kiện trên Lịch của hôm nay */
export function TodayEvents({ now }: { now: Date }) {
  const { data } = useAppState();
  const today = useMemo(() => expandEvents(data.events, now, now), [data.events, now]);

  return (
    <Card>
      <CardHeader
        icon={<CalendarDays className="h-4 w-4" aria-hidden />}
        title="Sự kiện hôm nay"
        action={
          <a href={routeHref('calendar')} className="text-xs font-extrabold text-brand-deep hover:underline">
            Mở lịch
          </a>
        }
      />
      {today.length === 0 ? (
        <p className="text-sm text-ink-mute">Hôm nay không có sự kiện nào.</p>
      ) : (
        <ul className="space-y-2">
          {today.map((o) => {
            const past = o.endMs < now.getTime();
            return (
              <li key={o.event.id} className={past ? 'opacity-50' : undefined}>
                <a href={routeHref('calendar')} className="flex gap-2.5 rounded-lg p-1 hover:bg-cream">
                  <span className="mt-0.5 w-1 shrink-0 rounded-full" style={{ backgroundColor: o.event.color }} aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{o.event.title}</span>
                    <span className="flex items-center gap-2 text-xs text-ink-mute">
                      {o.event.allDay ? 'Cả ngày' : `${formatTime(new Date(o.startMs).toISOString())} – ${formatTime(new Date(o.endMs).toISOString())}`}
                      {o.event.location && (
                        <span className="flex min-w-0 items-center gap-0.5 truncate">
                          <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                          {o.event.location}
                        </span>
                      )}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
