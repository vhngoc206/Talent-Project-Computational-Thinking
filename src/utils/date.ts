import { WEEKDAY_SHORT } from '../constants';

export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' theo giờ địa phương (không dùng toISOString vì nó là UTC). */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Số ngày (có phần thập phân) từ `now` đến `deadlineIso`. Âm nghĩa là đã quá hạn. */
export function daysUntil(deadlineIso: string, now: Date): number {
  return (new Date(deadlineIso).getTime() - now.getTime()) / MS_PER_DAY;
}

/** ISO -> giá trị cho <input type="datetime-local"> ('YYYY-MM-DDTHH:mm', giờ địa phương) */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${toDateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Giá trị <input type="datetime-local"> -> ISO. Trả về '' nếu không hợp lệ. */
export function localInputToIso(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/** Ngày + giờ địa phương cụ thể, ví dụ at(now, 2, 17, 0) = 17:00 sau 2 ngày. */
export function atTime(base: Date, dayOffset: number, hour: number, minute = 0): Date {
  const d = addDays(base, dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** "T6, 06/11 · 21:00" */
export function formatDeadline(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${WEEKDAY_SHORT[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 150 -> "2h 30p", 45 -> "45p", 120 -> "2h" */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}p`;
  return r === 0 ? `${h}h` : `${h}h ${r}p`;
}

/** Diễn đạt thời gian còn lại/quá hạn: "Còn 2 ngày", "Còn 5 giờ", "Quá hạn 1 ngày". */
export function formatCountdown(daysLeft: number): string {
  const abs = Math.abs(daysLeft);
  const days = Math.floor(abs);
  const hours = Math.floor(abs * 24);
  const minutes = Math.max(1, Math.floor(abs * 24 * 60));
  const span = days >= 1 ? `${days} ngày` : hours >= 1 ? `${hours} giờ` : `${minutes} phút`;
  return daysLeft < 0 ? `Quá hạn ${span}` : `Còn ${span}`;
}

/** Chào theo giờ trong ngày */
export function greetingForHour(hour: number): string {
  if (hour < 11) return 'Chào buổi sáng';
  if (hour < 14) return 'Chào buổi trưa';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

export function formatLongDate(date: Date): string {
  const names = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  return `${names[date.getDay()]}, ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}
