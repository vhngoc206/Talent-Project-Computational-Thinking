import { describe, expect, it } from 'vitest';
import { createSeedData } from '../services/seedData';
import type { SubjectInput, TaskInput } from '../types';
import { validateSubject, validateTask } from './validation';

const { subjects } = createSeedData(new Date('2026-11-04T08:00:00.000Z'));

const goodTask: TaskInput = {
  title: 'Bài tập',
  subjectId: 'sub-db',
  description: '',
  deadline: '2026-11-10T10:00:00.000Z',
  estimatedMinutes: 60,
  actualMinutes: 0,
  difficulty: 'medium',
  importance: 'medium',
  status: 'todo',
};

const goodSubject: SubjectInput = { name: 'Môn mới', code: 'NEW1', color: '#FF995E', difficulty: 'easy', description: '' };

describe('validateTask', () => {
  it('hợp lệ', () => expect(validateTask(goodTask, subjects).valid).toBe(true));

  it('bắt lỗi tên rỗng, thiếu môn, deadline sai, thời gian ngoài khoảng', () => {
    const r = validateTask(
      { ...goodTask, title: '   ', subjectId: 'x', deadline: 'abc', estimatedMinutes: 1 },
      subjects,
    );
    expect(r.valid).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(['deadline', 'estimatedMinutes', 'subjectId', 'title']);
  });

  it('thời gian học thực tế không được âm', () => {
    expect(validateTask({ ...goodTask, actualMinutes: -5 }, subjects).errors.actualMinutes).toBeDefined();
  });
});

describe('validateSubject', () => {
  it('hợp lệ', () => expect(validateSubject(goodSubject, subjects).valid).toBe(true));

  it('không cho trùng tên hoặc mã môn (trừ chính môn đang sửa)', () => {
    const dup = validateSubject({ ...goodSubject, name: 'cơ sở dữ liệu', code: 'db101' }, subjects);
    expect(dup.errors.name).toBeDefined();
    expect(dup.errors.code).toBeDefined();
    const self = validateSubject({ ...goodSubject, name: 'Cơ sở dữ liệu', code: 'DB101' }, subjects, 'sub-db');
    expect(self.valid).toBe(true);
  });

  it('bắt màu sai định dạng và tên rỗng', () => {
    const r = validateSubject({ ...goodSubject, name: '', color: 'red' }, subjects);
    expect(r.errors.name).toBeDefined();
    expect(r.errors.color).toBeDefined();
  });
});
