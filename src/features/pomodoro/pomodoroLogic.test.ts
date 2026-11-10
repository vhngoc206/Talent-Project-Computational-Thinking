import { describe, expect, it } from 'vitest';
import { formatClock, getNextPhase, PHASE_MINUTES } from './pomodoroLogic';

describe('Pomodoro – thời lượng', () => {
  it('25 phút tập trung, 5 phút nghỉ ngắn, 15 phút nghỉ dài', () => {
    expect(PHASE_MINUTES).toEqual({ focus: 25, short: 5, long: 15 });
  });
});

describe('getNextPhase', () => {
  it('sau mỗi phiên tập trung nghỉ ngắn; sau phiên thứ 4 nghỉ dài', () => {
    let state = { phase: 'focus' as const, completedFocus: 0 } as ReturnType<typeof getNextPhase>;
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      state = getNextPhase('focus', state.completedFocus);
      seen.push(state.phase);
      if (i < 3) state = getNextPhase(state.phase, state.completedFocus); // hết nghỉ -> focus
    }
    expect(seen).toEqual(['short', 'short', 'short', 'long']);
  });

  it('hết nghỉ dài thì reset chu kỳ; hết nghỉ ngắn giữ bộ đếm', () => {
    expect(getNextPhase('long', 4)).toEqual({ phase: 'focus', completedFocus: 0 });
    expect(getNextPhase('short', 2)).toEqual({ phase: 'focus', completedFocus: 2 });
  });
});

describe('formatClock', () => {
  it('định dạng mm:ss', () => {
    expect(formatClock(1500)).toBe('25:00');
    expect(formatClock(65)).toBe('01:05');
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(-3)).toBe('00:00');
  });
});
