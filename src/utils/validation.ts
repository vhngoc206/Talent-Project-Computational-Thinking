/** Kiểm tra dữ liệu đầu vào cho form Môn học / Nhiệm vụ. Hàm thuần, dễ test. */
import { SESSION_MINUTES_MAX, SESSION_MINUTES_MIN } from '../constants';
import type { Availability, Difficulty, Importance, Subject, SubjectInput, TaskInput, TaskStatus } from '../types';
import { activeDays } from './availability';


export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export interface ValidationResult<T> {
  valid: boolean;
  errors: FieldErrors<T>;
}

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const IMPORTANCES: Importance[] = ['low', 'medium', 'high'];
const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'completed'];

export const LIMITS = {
  subjectName: 60,
  subjectCode: 15,
  description: 500,
  taskTitle: 120,
  minEstimated: 5,
  maxEstimated: 2400, // 40 giờ
  maxActual: 10_000,
} as const;

export function validateSubject(
  input: SubjectInput,
  existing: Subject[],
  editingId?: string,
): ValidationResult<SubjectInput> {
  const errors: FieldErrors<SubjectInput> = {};
  const name = input.name.trim();
  const code = input.code.trim();

  if (!name) errors.name = 'Vui lòng nhập tên môn học.';
  else if (name.length > LIMITS.subjectName) errors.name = `Tên môn tối đa ${LIMITS.subjectName} ký tự.`;
  else if (existing.some((s) => s.id !== editingId && s.name.trim().toLowerCase() === name.toLowerCase()))
    errors.name = 'Đã có môn học trùng tên.';

  if (!code) errors.code = 'Vui lòng nhập mã môn.';
  else if (code.length > LIMITS.subjectCode) errors.code = `Mã môn tối đa ${LIMITS.subjectCode} ký tự.`;
  else if (existing.some((s) => s.id !== editingId && s.code.trim().toLowerCase() === code.toLowerCase()))
    errors.code = 'Mã môn này đã tồn tại.';

  if (!/^#[0-9a-fA-F]{6}$/.test(input.color)) errors.color = 'Màu không hợp lệ.';
  if (!DIFFICULTIES.includes(input.difficulty)) errors.difficulty = 'Mức độ khó không hợp lệ.';
  if (input.description.length > LIMITS.description)
    errors.description = `Mô tả tối đa ${LIMITS.description} ký tự.`;

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Kiểm tra thời gian rảnh. Trả về danh sách lỗi (rỗng = hợp lệ).
 * Quy tắc: ít nhất 1 ngày, 1–12 khung giờ, giờ đúng định dạng, bắt đầu < kết thúc,
 * các khung không chồng lên nhau, khung đủ dài cho ít nhất 1 phiên, nghỉ 0–60 phút.
 */
export function validateAvailability(a: Availability): string[] {
  const errors: string[] = [];
  const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
  const toMin = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));

  const hasOverrideTime = Object.values(a.dateOverrides ?? {}).some((l) => l.length > 0);
  if (a.perDay) {
    if (activeDays(a).length === 0 && !hasOverrideTime) errors.push('Chọn giờ rảnh cho ít nhất một ngày.');
  } else {
    if (a.days.length === 0) errors.push('Chọn ít nhất một ngày có thể học.');
    if (a.slots.length === 0) errors.push('Thêm ít nhất một khung giờ rảnh.');
  }
  const weekGroups = a.perDay ? Object.values(a.daySlots ?? {}) : [a.slots];
  const allSlots = [...weekGroups, ...Object.values(a.dateOverrides ?? {})].flat();
  if ([...weekGroups, ...Object.values(a.dateOverrides ?? {})].some((list) => list.length > 12)) errors.push('Tối đa 12 khung giờ mỗi ngày.');
  if (!Number.isInteger(a.sessionMinutes) || a.sessionMinutes < SESSION_MINUTES_MIN || a.sessionMinutes > SESSION_MINUTES_MAX)
    errors.push(`Thời lượng mỗi phiên phải từ ${SESSION_MINUTES_MIN} đến ${SESSION_MINUTES_MAX} phút.`);
  if (!Number.isInteger(a.breakMinutes) || a.breakMinutes < 0 || a.breakMinutes > 60) errors.push('Thời gian nghỉ phải từ 0 đến 60 phút.');

  const valid = allSlots.filter((s, i) => {
    if (!HHMM.test(s.start) || !HHMM.test(s.end)) {
      errors.push(`Khung giờ ${i + 1}: giờ không hợp lệ.`);
      return false;
    }
    if (toMin(s.end) <= toMin(s.start)) {
      errors.push(`Khung giờ ${i + 1}: giờ kết thúc phải sau giờ bắt đầu.`);
      return false;
    }
    if (toMin(s.end) - toMin(s.start) < 15) {
      errors.push(`Khung giờ ${i + 1}: cần dài ít nhất 15 phút.`);
      return false;
    }
    return true;
  });
  // Kiểm tra chồng giờ trong TỪNG ngày (ngày khác nhau thì không tính là chồng)
  const groups = [...weekGroups, ...Object.values(a.dateOverrides ?? {})];
  for (const group of groups) {
    const sorted = group.filter((s) => valid.includes(s)).sort((x, y) => toMin(x.start) - toMin(y.start));
    for (let i = 1; i < sorted.length; i++) {
      if (toMin(sorted[i].start) < toMin(sorted[i - 1].end)) {
        errors.push(`Khung ${sorted[i - 1].start}–${sorted[i - 1].end} và ${sorted[i].start}–${sorted[i].end} bị chồng lên nhau.`);
      }
    }
  }
  return [...new Set(errors)];
}

export function validateTask(input: TaskInput, subjects: Subject[]): ValidationResult<TaskInput> {
  const errors: FieldErrors<TaskInput> = {};
  const title = input.title.trim();

  if (!title) errors.title = 'Vui lòng nhập tên nhiệm vụ.';
  else if (title.length > LIMITS.taskTitle) errors.title = `Tên nhiệm vụ tối đa ${LIMITS.taskTitle} ký tự.`;

  if (!input.subjectId) errors.subjectId = 'Vui lòng chọn môn học.';
  else if (!subjects.some((s) => s.id === input.subjectId)) errors.subjectId = 'Môn học không tồn tại.';

  if (!input.deadline || Number.isNaN(new Date(input.deadline).getTime())) errors.deadline = 'Vui lòng chọn deadline hợp lệ.';

  if (!Number.isInteger(input.estimatedMinutes))
    errors.estimatedMinutes = 'Thời gian dự kiến phải là số nguyên (phút).';
  else if (input.estimatedMinutes < LIMITS.minEstimated || input.estimatedMinutes > LIMITS.maxEstimated)
    errors.estimatedMinutes = `Thời gian dự kiến từ ${LIMITS.minEstimated} đến ${LIMITS.maxEstimated} phút.`;

  if (!Number.isInteger(input.actualMinutes) || input.actualMinutes < 0 || input.actualMinutes > LIMITS.maxActual)
    errors.actualMinutes = 'Thời gian đã học phải là số nguyên không âm (phút).';

  if (!DIFFICULTIES.includes(input.difficulty)) errors.difficulty = 'Độ khó không hợp lệ.';
  if (!IMPORTANCES.includes(input.importance)) errors.importance = 'Mức quan trọng không hợp lệ.';
  if (!STATUSES.includes(input.status)) errors.status = 'Trạng thái không hợp lệ.';
  if (input.description.length > LIMITS.description) errors.description = `Mô tả tối đa ${LIMITS.description} ký tự.`;

  return { valid: Object.keys(errors).length === 0, errors };
}
