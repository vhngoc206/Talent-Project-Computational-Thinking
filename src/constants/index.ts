import type { Availability, Difficulty, Importance, SessionLength, TaskStatus } from '../types';

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Dễ',
  medium: 'Trung bình',
  hard: 'Khó',
};

export const IMPORTANCE_LABEL: Record<Importance, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'Cần làm',
  in_progress: 'Đang làm',
  completed: 'Hoàn thành',
};

export const DIFFICULTY_OPTIONS: Difficulty[] = ['easy', 'medium', 'hard'];
export const IMPORTANCE_OPTIONS: Importance[] = ['low', 'medium', 'high'];
export const STATUS_OPTIONS: TaskStatus[] = ['todo', 'in_progress', 'completed'];

/** Nhãn thứ trong tuần theo Date.getDay(): 0 = Chủ nhật */
export const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
export const WEEKDAY_LONG = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

/** Bảng màu gợi ý cho môn học (pastel nhưng đủ tương phản làm chấm màu) */
export const SUBJECT_COLORS = [
  '#7FAE6A', // rêu
  '#6E9FC9', // trời
  '#E0A458', // lúa chín
  '#C97B63', // mái ngói
  '#9B8BC4', // hoa oải hương
  '#5FA8A0', // suối
  '#D98CA0', // hoa anh đào
  '#8C7A5B', // vỏ cây
];

/** Các mức chọn nhanh; ngoài ra người dùng có thể tự nhập trong khoảng MIN–MAX */
export const SESSION_LENGTH_OPTIONS: SessionLength[] = [25, 45, 60, 90];
export const SESSION_MINUTES_MIN = 15;
export const SESSION_MINUTES_MAX = 180;

/** Thời gian rảnh mặc định (dùng ở Phase 3) */
export const DEFAULT_AVAILABILITY: Availability = {
  days: [1, 2, 3, 4, 5, 6],
  slots: [{ start: '19:00', end: '22:00' }],
  sessionMinutes: 45,
  breakMinutes: 10,
  perDay: false,
  daySlots: {},
  dateOverrides: {},
  autoReschedule: true,
};

export const DEFAULT_USER_NAME = 'bạn';
