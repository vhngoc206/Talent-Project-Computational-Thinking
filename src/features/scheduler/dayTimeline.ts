/**
 * Chuyển đổi giữa "khung giờ" (TimeSlot) và 48 ô nửa tiếng của một ngày (0:00 → 24:00).
 * Ô i = [i×30 phút, (i+1)×30 phút). Ô cuối cùng kết thúc lúc 23:59 (định dạng HH:mm không có 24:00).
 */
import type { TimeSlot } from '../../types';

export const CELLS_PER_DAY = 48;
const STEP = 30;

const toMin = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
export const cellTime = (index: number) => {
  if (index >= CELLS_PER_DAY) return '23:59';
  const m = index * STEP;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** Ô nào nằm TRỌN trong một khung giờ thì được đánh dấu */
export function slotsToCells(slots: TimeSlot[]): boolean[] {
  const cells = Array<boolean>(CELLS_PER_DAY).fill(false);
  for (const s of slots) {
    const start = toMin(s.start);
    // 23:59 được hiểu là hết ngày
    const end = s.end === '23:59' ? 24 * 60 : toMin(s.end);
    for (let i = 0; i < CELLS_PER_DAY; i++) {
      if (i * STEP >= start && (i + 1) * STEP <= end) cells[i] = true;
    }
  }
  return cells;
}

/** Gộp các ô liền nhau thành khung giờ */
export function cellsToSlots(cells: boolean[]): TimeSlot[] {
  const slots: TimeSlot[] = [];
  let i = 0;
  while (i < CELLS_PER_DAY) {
    if (!cells[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < CELLS_PER_DAY && cells[j]) j++;
    slots.push({ start: cellTime(i), end: cellTime(j) });
    i = j;
  }
  return slots;
}

/** Đặt các ô trong [from, to] (bao gồm cả hai đầu) thành `value` */
export function paintRange(cells: boolean[], from: number, to: number, value: boolean): boolean[] {
  const [a, b] = from <= to ? [from, to] : [to, from];
  return cells.map((c, i) => (i >= a && i <= b ? value : c));
}
