/** Đọc thời gian rảnh theo từng thứ trong tuần (hỗ trợ cả chế độ "giống nhau mọi ngày" và "mỗi ngày một kiểu"). */
import type { Availability, TimeSlot } from '../types';

/** Khung giờ rảnh của một thứ (0 = CN … 6 = T7) */
export function slotsForDay(a: Availability, weekday: number): TimeSlot[] {
  if (a.perDay) return a.daySlots?.[String(weekday)] ?? [];
  return a.days.includes(weekday) ? a.slots : [];
}

/** Khung giờ rảnh của một NGÀY cụ thể: ưu tiên ngày đặc biệt, nếu không thì theo lịch tuần */
export function slotsForDate(a: Availability, date: Date): TimeSlot[] {
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const override = a.dateOverrides?.[key];
  return override ?? slotsForDay(a, date.getDay());
}

/** Những thứ có ít nhất một khung giờ rảnh */
export function activeDays(a: Availability): number[] {
  return [0, 1, 2, 3, 4, 5, 6].filter((d) => slotsForDay(a, d).length > 0);
}

const toMin = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
export const slotMinutes = (s: TimeSlot) => Math.max(0, toMin(s.end) - toMin(s.start) + (s.end === '23:59' ? 1 : 0));

/** Tổng phút rảnh trong một tuần */
export function weeklyFreeMinutes(a: Availability): number {
  return [0, 1, 2, 3, 4, 5, 6].reduce((sum, d) => sum + slotsForDay(a, d).reduce((x, s) => x + slotMinutes(s), 0), 0);
}
