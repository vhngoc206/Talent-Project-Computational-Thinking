import { describe, expect, it } from 'vitest';
import { createSeedData } from '../services/seedData';
import type { Task } from '../types';
import { appReducer } from './appReducer';

const NOW = new Date('2026-11-04T08:00:00.000Z');
const NOW_ISO = NOW.toISOString();

function newTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-new',
    title: 'Nhiệm vụ mới',
    subjectId: 'sub-db',
    description: '',
    deadline: '2026-11-10T10:00:00.000Z',
    estimatedMinutes: 60,
    actualMinutes: 0,
    difficulty: 'medium',
    importance: 'medium',
    status: 'todo',
    createdAt: NOW_ISO,
    completedAt: null,
    ...overrides,
  };
}

describe('appReducer – CRUD nhiệm vụ', () => {
  it('thêm task', () => {
    const state = createSeedData(NOW);
    const next = appReducer(state, { type: 'task/add', task: newTask() });
    expect(next.tasks).toHaveLength(state.tasks.length + 1);
    expect(next.tasks.at(-1)?.title).toBe('Nhiệm vụ mới');
  });

  it('sửa task giữ nguyên các task khác', () => {
    const state = appReducer(createSeedData(NOW), { type: 'task/add', task: newTask() });
    const next = appReducer(state, {
      type: 'task/update',
      task: newTask({ title: 'Đã đổi tên', estimatedMinutes: 120 }),
      now: NOW_ISO,
    });
    const updated = next.tasks.find((t) => t.id === 'task-new')!;
    expect(updated.title).toBe('Đã đổi tên');
    expect(updated.estimatedMinutes).toBe(120);
    expect(next.tasks).toHaveLength(state.tasks.length);
  });

  it('xóa task, kèm các phiên học của task đó', () => {
    const state = createSeedData(NOW);
    const target = state.tasks.find((t) => state.sessions.some((s) => s.taskId === t.id))!;
    const next = appReducer(state, { type: 'task/delete', id: target.id });
    expect(next.tasks.find((t) => t.id === target.id)).toBeUndefined();
    expect(next.sessions.some((s) => s.taskId === target.id)).toBe(false);
  });

  it('đánh dấu hoàn thành đặt completedAt, mở lại thì xóa completedAt', () => {
    const state = appReducer(createSeedData(NOW), { type: 'task/add', task: newTask() });
    const done = appReducer(state, { type: 'task/setStatus', id: 'task-new', status: 'completed', now: NOW_ISO });
    const t1 = done.tasks.find((t) => t.id === 'task-new')!;
    expect(t1.status).toBe('completed');
    expect(t1.completedAt).toBe(NOW_ISO);

    const reopened = appReducer(done, { type: 'task/setStatus', id: 'task-new', status: 'todo', now: NOW_ISO });
    const t2 = reopened.tasks.find((t) => t.id === 'task-new')!;
    expect(t2.status).toBe('todo');
    expect(t2.completedAt).toBeNull();
  });

  it('sửa trạng thái sang Hoàn thành qua form cũng đặt completedAt', () => {
    const state = appReducer(createSeedData(NOW), { type: 'task/add', task: newTask() });
    const next = appReducer(state, { type: 'task/update', task: newTask({ status: 'completed' }), now: NOW_ISO });
    expect(next.tasks.find((t) => t.id === 'task-new')?.completedAt).toBe(NOW_ISO);
  });
});

describe('appReducer – môn học', () => {
  it('xóa môn học xóa luôn nhiệm vụ và phiên học thuộc môn đó', () => {
    const state = createSeedData(NOW);
    const next = appReducer(state, { type: 'subject/delete', id: 'sub-db' });
    expect(next.subjects.find((s) => s.id === 'sub-db')).toBeUndefined();
    expect(next.tasks.some((t) => t.subjectId === 'sub-db')).toBe(false);
    expect(next.sessions.some((s) => s.subjectId === 'sub-db')).toBe(false);
    // các môn khác không bị ảnh hưởng
    expect(next.tasks.some((t) => t.subjectId === 'sub-web')).toBe(true);
  });

  it('thêm và sửa môn học', () => {
    const state = createSeedData(NOW);
    const subject = { id: 'sub-x', name: 'Môn X', code: 'X1', color: '#FF995E', difficulty: 'easy' as const, description: '' };
    const added = appReducer(state, { type: 'subject/add', subject });
    expect(added.subjects).toHaveLength(state.subjects.length + 1);
    const edited = appReducer(added, { type: 'subject/update', subject: { ...subject, name: 'Môn Y' } });
    expect(edited.subjects.find((s) => s.id === 'sub-x')?.name).toBe('Môn Y');
  });
});

describe('appReducer – ghi nhận giờ học', () => {
  it('cộng actualMinutes, tạo phiên học, và chuyển Cần làm -> Đang làm', () => {
    const state = createSeedData(NOW);
    const todo = state.tasks.find((t) => t.status === 'todo')!;
    const next = appReducer(state, {
      type: 'study/log',
      sessionId: 'ses-1',
      taskId: todo.id,
      minutes: 25,
      date: '2026-11-04',
      origin: 'pomodoro',
    });
    const updated = next.tasks.find((t) => t.id === todo.id)!;
    expect(updated.actualMinutes).toBe(todo.actualMinutes + 25);
    expect(updated.status).toBe('in_progress');
    expect(next.sessions.at(-1)).toMatchObject({ taskId: todo.id, minutes: 25, completed: true, origin: 'pomodoro' });
  });

  it('bỏ qua nếu task không tồn tại hoặc số phút không hợp lệ', () => {
    const state = createSeedData(NOW);
    const a = appReducer(state, { type: 'study/log', sessionId: 's', taskId: 'nope', minutes: 25, date: '2026-11-04', origin: 'pomodoro' });
    const b = appReducer(state, { type: 'study/log', sessionId: 's', taskId: state.tasks[0].id, minutes: 0, date: '2026-11-04', origin: 'pomodoro' });
    expect(a).toBe(state);
    expect(b).toBe(state);
  });
});
