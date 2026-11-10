import { describe, expect, it } from 'vitest';
import { CELLS_PER_DAY, cellsToSlots, paintRange, slotsToCells } from './dayTimeline';

describe('Bảng chọn giờ cả ngày', () => {
  it('khung 07:00–12:00 = 10 ô nửa tiếng', () => {
    const cells = slotsToCells([{ start: '07:00', end: '12:00' }]);
    expect(cells.filter(Boolean)).toHaveLength(10);
    expect(cells[14]).toBe(true);
    expect(cells[24]).toBe(false);
  });

  it('các ô liền nhau gộp thành một khung; ô cuối kết thúc 23:59', () => {
    let cells = Array<boolean>(CELLS_PER_DAY).fill(false);
    cells = paintRange(cells, 38, 43, true); // 19:00–22:00
    cells = paintRange(cells, 46, 47, true); // 23:00–24:00
    expect(cellsToSlots(cells)).toEqual([
      { start: '19:00', end: '22:00' },
      { start: '23:00', end: '23:59' },
    ]);
  });

  it('chọn cả ngày rồi chuyển qua lại vẫn giữ nguyên', () => {
    const all = cellsToSlots(paintRange(Array<boolean>(CELLS_PER_DAY).fill(false), 0, 47, true));
    expect(all).toEqual([{ start: '00:00', end: '23:59' }]);
    expect(slotsToCells(all).every(Boolean)).toBe(true);
  });

  it('kéo ngược chiều (từ ô sau về ô trước) vẫn tô đúng', () => {
    const cells = paintRange(Array<boolean>(CELLS_PER_DAY).fill(false), 30, 26, true);
    expect(cellsToSlots(cells)).toEqual([{ start: '13:00', end: '15:30' }]);
  });
});
