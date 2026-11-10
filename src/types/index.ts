/**
 * Toàn bộ kiểu dữ liệu dùng chung của SmartStudy AI.
 * Ngày giờ lưu dưới dạng chuỗi ISO 8601 (UTC) để JSON/LocalStorage an toàn;
 * ngày theo lịch học lưu dạng 'YYYY-MM-DD' (giờ địa phương) và giờ dạng 'HH:mm'.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';
export type Importance = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in_progress' | 'completed';

/** Môn học */
export interface Subject {
  id: string;
  name: string;
  code: string;
  /** Màu hex, ví dụ '#FF995E' */
  color: string;
  difficulty: Difficulty;
  description: string;
}

/** Bài tập / nhiệm vụ */
export interface Task {
  id: string;
  title: string;
  subjectId: string;
  description: string;
  /** Hạn nộp (ISO 8601) */
  deadline: string;
  /** Thời gian học dự kiến (phút) */
  estimatedMinutes: number;
  /** Thời gian học thực tế đã ghi nhận (phút) */
  actualMinutes: number;
  difficulty: Difficulty;
  importance: Importance;
  status: TaskStatus;
  createdAt: string;
  /** Thời điểm hoàn thành; null nếu chưa hoàn thành */
  completedAt: string | null;
}

/** Dữ liệu người dùng nhập khi tạo/sửa task (chưa có id, createdAt, completedAt) */
export type TaskInput = Omit<Task, 'id' | 'createdAt' | 'completedAt'>;
export type SubjectInput = Omit<Subject, 'id'>;

export type SessionOrigin = 'scheduler' | 'pomodoro' | 'manual';

/**
 * Một phiên học.
 * - origin 'scheduler': phiên được Greedy Scheduler xếp trong lịch (completed=false đến khi hoàn thành)
 * - origin 'pomodoro' | 'manual': phiên đã học thật, được ghi nhận (completed=true)
 */
export interface StudySession {
  id: string;
  taskId: string;
  subjectId: string;
  /** 'YYYY-MM-DD' theo giờ địa phương */
  date: string;
  /** 'HH:mm' – null với phiên ghi nhận không có giờ cụ thể */
  startTime: string | null;
  endTime: string | null;
  minutes: number;
  completed: boolean;
  origin: SessionOrigin;
  /** true = người dùng tự chọn giờ cho phiên này – lịch tự động giữ nguyên, không dời đi */
  pinned?: boolean;
}

/** Khung giờ rảnh trong ngày */
export interface TimeSlot {
  start: string; // 'HH:mm'
  end: string; // 'HH:mm'
}

/** Độ dài tối đa một phiên học (phút) – chọn nhanh 25/45/60/90 hoặc tự nhập 15–180 */
export type SessionLength = number;

/** Thời gian rảnh của sinh viên – đầu vào của Greedy Scheduler (Phase 3) */
export interface Availability {
  /** Các ngày có thể học: 0 = Chủ nhật … 6 = Thứ bảy */
  days: number[];
  /** Khung giờ dùng chung cho mọi ngày đã chọn (khi perDay = false) */
  slots: TimeSlot[];
  sessionMinutes: SessionLength;
  breakMinutes: number;
  /** true = mỗi thứ trong tuần có khung giờ riêng (daySlots) */
  perDay?: boolean;
  /** Khung giờ riêng theo thứ: khóa '0' (CN) … '6' (T7) */
  daySlots?: Record<string, TimeSlot[]>;
  /**
   * Ngày đặc biệt: giờ rảnh riêng cho một ngày cụ thể ('YYYY-MM-DD'), thay cho lịch tuần của ngày đó.
   * Mảng rỗng = nghỉ cả ngày.
   */
  dateOverrides?: Record<string, TimeSlot[]>;
  /** Tự động xếp lại lịch khi dữ liệu đổi hoặc có phiên bị lỡ (mặc định bật) */
  autoReschedule?: boolean;
}

export interface UnscheduledTask {
  taskId: string;
  missingMinutes: number;
  reason: string;
}

/** Số liệu tổng hợp của một lần lập lịch (phút) */
export interface ScheduleStats {
  /** Tổng thời gian còn phải học của các task chưa xong */
  requiredMinutes: number;
  /** Tổng thời gian đã xếp được vào lịch */
  scheduledMinutes: number;
  /** Tổng thời gian rảnh trong phạm vi lập lịch */
  capacityMinutes: number;
  /** Số ngày được xét (từ hôm nay) */
  horizonDays: number;
}

/** Kết quả của một lần tạo lịch học */
export interface StudySchedule {
  generatedAt: string;
  sessions: StudySession[];
  unscheduled: UnscheduledTask[];
  warnings: string[];
  stats: ScheduleStats;
  /** "Dấu vân tay" dữ liệu đầu vào – khác với hiện tại nghĩa là lịch đã cũ, cần tạo lại */
  inputSignature: string;
}

export type EventRepeat = 'none' | 'daily' | 'weekly';

/**
 * Sự kiện trên Lịch (giống Google Calendar): lịch học trên lớp, họp nhóm, đi làm thêm…
 * Sự kiện có `blocksStudy = true` được Greedy Scheduler coi là giờ BẬN.
 */
export interface CalendarEvent {
  id: string;
  title: string;
  /** Ngày bắt đầu 'YYYY-MM-DD' (giờ địa phương) */
  date: string;
  /** 'HH:mm' – bỏ qua khi allDay */
  startTime: string;
  endTime: string;
  allDay: boolean;
  /** Màu hex */
  color: string;
  location: string;
  description: string;
  repeat: EventRepeat;
  /** Ngày cuối cùng lặp lại ('YYYY-MM-DD'); null = lặp mãi */
  repeatUntil: string | null;
  blocksStudy: boolean;
}

export type CalendarEventInput = Omit<CalendarEvent, 'id'>;

/** Toàn bộ dữ liệu ứng dụng – đây cũng là thứ được lưu vào LocalStorage */
export interface AppData {
  subjects: Subject[];
  tasks: Task[];
  sessions: StudySession[];
  availability: Availability;
  schedule: StudySchedule | null;
  events: CalendarEvent[];
  userName: string;
}
