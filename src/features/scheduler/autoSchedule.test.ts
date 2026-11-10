import { describe, expect, it } from 'vitest';
import { buildFreeBlocks, FINISHING_MINUTES, generateSchedule } from '../../algorithms/greedyScheduler';
import { createSeedData } from '../../services/seedData';
import type { AppData, Availability, Task } from '../../types';
import { validateAvailability } from '../../utils/validation';
import { dueSoon, formatMinutesLeft } from '../tasks/deadlineAlerts';
import { missedSessions, rescheduleReason } from './autoSchedule';

// Thứ tư 04/11/2026, 08:00
const NOW = new Date(2026, 10, 4, 8, 0, 0);
const at = (dayOffset: number, h: number, m = 0) => new Date(2026, 10, 4 + dayOffset, h, m, 0);

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Task',
    subjectId: 's1',
    description: '',
    deadline: at(6, 23, 59).toISOString(),
    estimatedMinutes: 60,
    actualMinutes: 0,
    difficulty: 'medium',
    importance: 'medium',
    status: 'todo',
    createdAt: at(-2, 8).toISOString(),
    completedAt: null,
    ...overrides,
  };
}

describe('Giờ rảnh riêng từng ngày', () => {
  const perDay: Availability = {
    days: [],
    slots: [],
    sessionMinutes: 45,
    breakMinutes: 10,
    perDay: true,
    // Thứ tư 8h–10h, thứ năm chỉ buổi tối 19h–21h, các ngày khác nghỉ
    daySlots: { '3': [{ start: '08:00', end: '10:00' }], '4': [{ start: '19:00', end: '21:00' }] },
  };

  it('mỗi thứ dùng đúng khung giờ của thứ đó', () => {
    const blocks = buildFreeBlocks(perDay, NOW, 7);
    expect(blocks).toHaveLength(2);
    expect(new Date(blocks[0].startMs).getHours()).toBe(8); // thứ tư
    expect(new Date(blocks[1].startMs).getDay()).toBe(4); // thứ năm
    expect(new Date(blocks[1].startMs).getHours()).toBe(19);
  });

  it('kiểm tra hợp lệ: cần ít nhất một ngày có giờ; ngày khác nhau không tính là chồng giờ', () => {
    expect(validateAvailability(perDay)).toEqual([]);
    expect(validateAvailability({ ...perDay, daySlots: {} })).toContain('Chọn giờ rảnh cho ít nhất một ngày.');
  });

  it('ngày đặc biệt thay cho lịch tuần của đúng ngày đó (rảnh thêm hoặc nghỉ cả ngày)', () => {
    const withOverrides: Availability = {
      ...perDay,
      dateOverrides: {
        '2026-11-04': [], // thứ tư này nghỉ cả ngày
        '2026-11-07': [{ start: '09:00', end: '17:00' }], // thứ bảy này rảnh cả ngày (bình thường nghỉ)
      },
    };
    const blocks = buildFreeBlocks(withOverrides, NOW, 7);
    const byDay = blocks.map((b) => new Date(b.startMs).getDate());
    expect(byDay).not.toContain(4);
    expect(byDay).toContain(5); // thứ năm vẫn theo lịch tuần
    const sat = blocks.find((b) => new Date(b.startMs).getDate() === 7)!;
    expect((sat.endMs - sat.startMs) / 3_600_000).toBe(8);
    // Thứ tư tuần sau (không có ngày đặc biệt) lại theo lịch tuần
    expect(buildFreeBlocks(withOverrides, at(7, 6), 1)).toHaveLength(1);
    expect(validateAvailability(withOverrides)).toEqual([]);
  });

  it('khung tới cuối ngày: phiên kết thúc muộn nhất 23:59 và KHÔNG bị coi là đã lỡ ngay khi vừa xếp', () => {
    const late: Availability = { days: [0, 1, 2, 3, 4, 5, 6], slots: [{ start: '22:00', end: '23:59' }], sessionMinutes: 60, breakMinutes: 0 };
    const now = at(0, 22, 0);
    const s = generateSchedule([task({ estimatedMinutes: 600 })], late, { now });
    expect(s.sessions.every((x) => x.endTime !== '00:00')).toBe(true);
    expect(missedSessions(s.sessions, now)).toHaveLength(0);
  });

  it('phiên cũ kết thúc lúc 00:00 được hiểu là hết lúc nửa đêm, không phải đầu ngày', () => {
    const old = { id: 'x', taskId: 't1', subjectId: 's1', date: '2026-11-04', startTime: '23:00', endTime: '00:00', minutes: 60, completed: false, origin: 'scheduler' as const };
    expect(missedSessions([old], at(0, 23, 30))).toHaveLength(0);
    expect(missedSessions([old], at(1, 0, 5))).toHaveLength(1);
  });
});

describe('Thời lượng phiên tự chọn', () => {
  const base: Availability = { days: [3], slots: [{ start: '08:00', end: '12:00' }], sessionMinutes: 30, breakMinutes: 0 };
  it('chấp nhận 15–180 phút và chia phiên đúng độ dài đã chọn', () => {
    expect(validateAvailability(base)).toEqual([]);
    expect(validateAvailability({ ...base, sessionMinutes: 10 })[0]).toMatch(/15 đến 180/);
    expect(validateAvailability({ ...base, sessionMinutes: 200 })[0]).toMatch(/15 đến 180/);
    const s = generateSchedule([task({ estimatedMinutes: 90 })], base, { now: NOW });
    expect(s.sessions.map((x) => x.minutes)).toEqual([30, 30, 30]);
  });
});

describe('Tự động dời việc chưa xong', () => {
  const availability: Availability = { days: [0, 1, 2, 3, 4, 5, 6], slots: [{ start: '19:00', end: '21:00' }], sessionMinutes: 45, breakMinutes: 10 };

  it('đã học đủ giờ dự kiến nhưng chưa tick hoàn thành => vẫn xếp thêm phiên hoàn thiện', () => {
    const s = generateSchedule([task({ estimatedMinutes: 60, actualMinutes: 60 })], availability, { now: NOW });
    expect(s.sessions).toHaveLength(1);
    expect(s.sessions[0].minutes).toBe(FINISHING_MINUTES);
    // Đã tick hoàn thành thì không xếp nữa
    expect(generateSchedule([task({ status: 'completed' })], availability, { now: NOW }).sessions).toHaveLength(0);
  });

  function appWithSchedule(now: Date): AppData {
    const data = { ...createSeedData(now), tasks: [task()], availability, events: [] };
    return { ...data, schedule: generateSchedule(data.tasks, data.availability, { now, signatureEvents: [] }) };
  }

  it('phiên đã qua giờ mà chưa tick => cần xếp lại (missed)', () => {
    const data = appWithSchedule(NOW);
    expect(rescheduleReason(data, NOW)).toBeNull();
    const later = at(0, 21, 30); // sau buổi tối hôm nay
    expect(missedSessions(data.schedule!.sessions, later).length).toBeGreaterThan(0);
    expect(rescheduleReason(data, later)).toBe('missed');
    // Xếp lại lúc đó => phiên mới bắt đầu từ ngày mai, không còn phiên bị lỡ
    const again = generateSchedule(data.tasks, data.availability, { now: later, signatureEvents: [] });
    expect(again.sessions[0].date).toBe('2026-11-05');
    expect(rescheduleReason({ ...data, schedule: again }, later)).toBeNull();
  });

  it('sửa nhiệm vụ => lịch cũ (stale); chưa có lịch => initial; tắt tự động => không làm gì', () => {
    const data = appWithSchedule(NOW);
    expect(rescheduleReason({ ...data, tasks: [task({ estimatedMinutes: 120 })] }, NOW)).toBe('stale');
    expect(rescheduleReason({ ...data, schedule: null }, NOW)).toBe('initial');
    expect(rescheduleReason({ ...data, schedule: null, availability: { ...availability, autoReschedule: false } }, NOW)).toBeNull();
  });
});

describe('Cảnh báo trước deadline 1 tiếng', () => {
  it('chỉ báo nhiệm vụ chưa xong, còn ≤ 60 phút và chưa quá hạn', () => {
    const tasks = [
      task({ id: 'a', deadline: at(0, 8, 45).toISOString() }), // còn 45 phút
      task({ id: 'b', deadline: at(0, 10, 0).toISOString() }), // còn 2 tiếng
      task({ id: 'c', deadline: at(0, 7, 30).toISOString() }), // đã quá hạn
      task({ id: 'd', deadline: at(0, 8, 30).toISOString(), status: 'completed' }),
    ];
    const soon = dueSoon(tasks, NOW);
    expect(soon.map((s) => s.task.id)).toEqual(['a']);
    expect(formatMinutesLeft(soon[0].minutesLeft)).toBe('45 phút');
  });
});
