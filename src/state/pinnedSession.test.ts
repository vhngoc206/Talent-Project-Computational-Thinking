import { describe, expect, it } from 'vitest';
import { createEmptyData } from '../services/seedData';
import type { AppData, StudySession, Task } from '../types';
import { rebuildSchedule, validatePinnedSession } from './AppStateContext';

// Thứ tư 04/11/2026, 08:00
const NOW = new Date(2026, 10, 4, 8, 0, 0);

const task: Task = {
  id: 't1',
  title: 'Báo cáo',
  subjectId: 's1',
  description: '',
  deadline: new Date(2026, 10, 10, 23, 59).toISOString(),
  estimatedMinutes: 120,
  actualMinutes: 0,
  difficulty: 'medium',
  importance: 'high',
  status: 'todo',
  createdAt: NOW.toISOString(),
  completedAt: null,
};

function data(sessions: StudySession[] = []): AppData {
  const d = createEmptyData();
  return {
    ...d,
    tasks: [task],
    availability: { days: [0, 1, 2, 3, 4, 5, 6], slots: [{ start: '19:00', end: '22:00' }], sessionMinutes: 60, breakMinutes: 0 },
    schedule: sessions.length ? { ...rebuildSchedule({ ...d, tasks: [task] }, NOW), sessions } : null,
  };
}

const pinned = (startTime: string, endTime: string, date = '2026-11-04'): StudySession => ({
  id: 'pin1',
  taskId: 't1',
  subjectId: 's1',
  date,
  startTime,
  endTime,
  minutes: Number(endTime.slice(0, 2)) * 60 + Number(endTime.slice(3)) - (Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3))),
  completed: false,
  origin: 'scheduler',
  pinned: true,
});

describe('Phiên học tự chọn giờ', () => {
  it('lịch giữ nguyên phiên bạn chọn và chỉ xếp phần còn thiếu', () => {
    // Tự học 09:00–10:00 (ngoài giờ rảnh 19–22h) => Greedy chỉ cần xếp thêm 60 phút
    const s = rebuildSchedule(data([pinned('09:00', '10:00')]), NOW);
    const kept = s.sessions.find((x) => x.id === 'pin1');
    expect(kept?.startTime).toBe('09:00');
    const auto = s.sessions.filter((x) => !x.pinned);
    expect(auto.reduce((m, x) => m + x.minutes, 0)).toBe(60);
  });

  it('phiên chọn nằm trong giờ rảnh thì Greedy không xếp đè lên', () => {
    const s = rebuildSchedule(data([pinned('19:00', '20:00')]), NOW);
    const today = s.sessions.filter((x) => x.date === '2026-11-04');
    for (const x of today.filter((y) => !y.pinned)) expect(x.startTime! >= '20:00').toBe(true);
  });

  it('phiên chọn đã qua giờ mà chưa học thì bị bỏ và thời gian đó được xếp lại', () => {
    const later = new Date(2026, 10, 4, 11, 0);
    const s = rebuildSchedule(data([pinned('09:00', '10:00')]), later);
    expect(s.sessions.some((x) => x.id === 'pin1')).toBe(false);
    expect(s.sessions.reduce((m, x) => m + x.minutes, 0)).toBe(120);
  });

  it('kiểm tra: giờ đã qua, quá ngắn, trùng phiên đã chọn', () => {
    const d = data([pinned('19:00', '20:00')]);
    expect(validatePinnedSession(d, { taskId: 't1', date: '2026-11-04', startTime: '06:00', endTime: '07:00' }, NOW)).toMatch(/đã qua/);
    expect(validatePinnedSession(d, { taskId: 't1', date: '2026-11-04', startTime: '09:00', endTime: '09:10' }, NOW)).toMatch(/15 phút/);
    expect(validatePinnedSession(d, { taskId: 't1', date: '2026-11-04', startTime: '19:30', endTime: '20:30' }, NOW)).toMatch(/Trùng giờ/);
    expect(validatePinnedSession(d, { taskId: 't1', date: '2026-11-04', startTime: '20:00', endTime: '21:00' }, NOW)).toBeNull();
    // Sửa chính phiên đó thì không tính là trùng
    expect(validatePinnedSession(d, { id: 'pin1', taskId: 't1', date: '2026-11-04', startTime: '19:30', endTime: '20:30' }, NOW)).toBeNull();
  });
});
