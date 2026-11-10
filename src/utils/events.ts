/**
 * Tiện ích thuần cho Sự kiện lịch: kiểm tra, "trải" sự kiện lặp lại thành từng lần xảy ra,
 * và đổi sự kiện thành các khoảng thời gian bận cho Greedy Scheduler.
 */
import type { CalendarEvent, CalendarEventInput } from '../types';
import { addDays, toDateKey } from './date';

/** Một lần xảy ra cụ thể của sự kiện (sự kiện lặp lại có nhiều lần) */
export interface EventOccurrence {
  event: CalendarEvent;
  /** 'YYYY-MM-DD' */
  date: string;
  startMs: number;
  endMs: number;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** 'YYYY-MM-DD' + 'HH:mm' -> Date theo giờ địa phương */
export function dateAt(dateKey: string, time = '00:00'): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min, 0, 0);
}

export function validateEvent(input: CalendarEventInput): Partial<Record<keyof CalendarEventInput, string>> {
  const errors: Partial<Record<keyof CalendarEventInput, string>> = {};
  if (!input.title.trim()) errors.title = 'Nhập tên sự kiện.';
  else if (input.title.trim().length > 80) errors.title = 'Tên tối đa 80 ký tự.';
  if (!DATE_KEY.test(input.date)) errors.date = 'Chọn ngày.';
  if (!input.allDay) {
    if (!HHMM.test(input.startTime)) errors.startTime = 'Giờ bắt đầu không hợp lệ.';
    if (!HHMM.test(input.endTime)) errors.endTime = 'Giờ kết thúc không hợp lệ.';
    else if (input.endTime <= input.startTime) errors.endTime = 'Giờ kết thúc phải sau giờ bắt đầu.';
  }
  if (input.repeat !== 'none' && input.repeatUntil && input.repeatUntil < input.date) errors.repeatUntil = 'Ngày kết thúc lặp phải sau ngày bắt đầu.';
  return errors;
}

/** Sự kiện có xảy ra vào ngày `dateKey` không (tính cả lặp lại). */
export function occursOn(event: CalendarEvent, dateKey: string): boolean {
  if (dateKey < event.date) return false;
  if (event.repeat === 'none') return dateKey === event.date;
  if (event.repeatUntil && dateKey > event.repeatUntil) return false;
  if (event.repeat === 'daily') return true;
  return dateAt(dateKey).getDay() === dateAt(event.date).getDay();
}

/** Mọi lần xảy ra của các sự kiện trong các ngày [from, to] (tính theo ngày), sắp theo thời gian. */
export function expandEvents(events: CalendarEvent[], from: Date, to: Date): EventOccurrence[] {
  const out: EventOccurrence[] = [];
  for (let d = new Date(from.getFullYear(), from.getMonth(), from.getDate()); d <= to; d = addDays(d, 1)) {
    const key = toDateKey(d);
    for (const event of events) {
      if (!occursOn(event, key)) continue;
      const start = event.allDay ? dateAt(key) : dateAt(key, event.startTime);
      const end = event.allDay ? addDays(dateAt(key), 1) : dateAt(key, event.endTime);
      out.push({ event, date: key, startMs: start.getTime(), endMs: end.getTime() });
    }
  }
  return out.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
}

/** Khoảng thời gian bận (để Greedy Scheduler không xếp phiên học chồng lên sự kiện). */
export function busyIntervals(events: CalendarEvent[], from: Date, to: Date): Array<{ startMs: number; endMs: number }> {
  return expandEvents(
    events.filter((e) => e.blocksStudy),
    from,
    to,
  ).map(({ startMs, endMs }) => ({ startMs, endMs }));
}

/**
 * Xếp các sự kiện chồng giờ trong một ngày thành nhiều "cột" (như Google Calendar)
 * để hiển thị cạnh nhau. Trả về chỉ số cột và tổng số cột của nhóm chồng nhau.
 */
export function layoutOverlaps<T extends { startMs: number; endMs: number }>(items: T[]): Array<T & { col: number; cols: number }> {
  const sorted = [...items].sort((a, b) => a.startMs - b.startMs || b.endMs - a.endMs);
  const result: Array<T & { col: number; cols: number }> = [];
  let group: Array<T & { col: number; cols: number }> = [];
  let groupEnd = -Infinity;
  const flush = () => {
    const cols = Math.max(1, ...group.map((g) => g.col + 1));
    for (const g of group) g.cols = cols;
    result.push(...group);
    group = [];
  };
  for (const item of sorted) {
    if (item.startMs >= groupEnd && group.length) flush();
    // Cột trống đầu tiên trong nhóm
    const used = new Set(group.filter((g) => g.endMs > item.startMs).map((g) => g.col));
    let col = 0;
    while (used.has(col)) col++;
    group.push({ ...item, col, cols: 1 });
    groupEnd = Math.max(groupEnd, item.endMs);
  }
  if (group.length) flush();
  return result;
}
