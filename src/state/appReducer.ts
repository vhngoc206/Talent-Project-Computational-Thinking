/**
 * Reducer thuần cho toàn bộ dữ liệu ứng dụng (CRUD môn học, nhiệm vụ, ghi nhận giờ học).
 * Không tự tạo id/thời gian bên trong (để kết quả luôn dự đoán được và test dễ) –
 * id và mốc thời gian do nơi gọi (AppStateContext) truyền vào qua action.
 */
import type {
  AppData,
  Availability,
  CalendarEvent,
  SessionOrigin,
  StudySchedule,
  StudySession,
  Subject,
  Task,
  TaskStatus,
} from '../types';

export type AppAction =
  | { type: 'subject/add'; subject: Subject }
  | { type: 'subject/update'; subject: Subject }
  | { type: 'subject/delete'; id: string }
  | { type: 'task/add'; task: Task }
  | { type: 'task/update'; task: Task; now: string }
  | { type: 'task/delete'; id: string }
  | { type: 'task/setStatus'; id: string; status: TaskStatus; now: string }
  | { type: 'study/log'; sessionId: string; taskId: string; minutes: number; date: string; origin: SessionOrigin }
  | { type: 'availability/set'; availability: Availability }
  | { type: 'schedule/set'; schedule: StudySchedule | null }
  /** Đánh dấu một phiên trong lịch là đã học / chưa học. `today` = 'YYYY-MM-DD' hôm nay */
  | { type: 'schedule/toggleSession'; sessionId: string; completed: boolean; today: string }
  | { type: 'event/add'; event: CalendarEvent }
  | { type: 'event/update'; event: CalendarEvent }
  | { type: 'event/delete'; id: string }
  | { type: 'user/setName'; name: string }
  | { type: 'data/replace'; data: AppData };

/** Đồng bộ completedAt với status: hoàn thành => có mốc thời gian, ngược lại => null. */
export function normalizeCompletion(task: Task, now: string): Task {
  if (task.status === 'completed') return { ...task, completedAt: task.completedAt ?? now };
  return { ...task, completedAt: null };
}

/** Bỏ các phiên của lịch học thuộc những task không còn tồn tại. */
function pruneSchedule(schedule: StudySchedule | null, taskIds: Set<string>): StudySchedule | null {
  if (!schedule) return null;
  return {
    ...schedule,
    sessions: schedule.sessions.filter((s) => taskIds.has(s.taskId)),
    unscheduled: schedule.unscheduled.filter((u) => taskIds.has(u.taskId)),
  };
}

function removeTasks(state: AppData, shouldRemove: (t: Task) => boolean): AppData {
  const tasks = state.tasks.filter((t) => !shouldRemove(t));
  const ids = new Set(tasks.map((t) => t.id));
  return {
    ...state,
    tasks,
    sessions: state.sessions.filter((s) => ids.has(s.taskId)),
    schedule: pruneSchedule(state.schedule, ids),
  };
}

export function appReducer(state: AppData, action: AppAction): AppData {
  switch (action.type) {
    case 'subject/add':
      return { ...state, subjects: [...state.subjects, action.subject] };

    case 'subject/update':
      return { ...state, subjects: state.subjects.map((s) => (s.id === action.subject.id ? action.subject : s)) };

    case 'subject/delete':
      // Xóa môn => xóa luôn các nhiệm vụ (và phiên học) thuộc môn đó
      return removeTasks(
        { ...state, subjects: state.subjects.filter((s) => s.id !== action.id) },
        (t) => t.subjectId === action.id,
      );

    case 'task/add':
      return { ...state, tasks: [...state.tasks, action.task] };

    case 'task/update':
      return {
        ...state,
        // createdAt và completedAt luôn giữ theo bản ghi cũ; completedAt chỉ đổi theo status
        tasks: state.tasks.map((t) =>
          t.id === action.task.id
            ? normalizeCompletion({ ...action.task, createdAt: t.createdAt, completedAt: t.completedAt }, action.now)
            : t,
        ),
      };

    case 'task/delete':
      return removeTasks(state, (t) => t.id === action.id);

    case 'task/setStatus':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id ? normalizeCompletion({ ...t, status: action.status }, action.now) : t,
        ),
      };

    case 'study/log': {
      const task = state.tasks.find((t) => t.id === action.taskId);
      if (!task || action.minutes <= 0) return state;
      const session: StudySession = {
        id: action.sessionId,
        taskId: task.id,
        subjectId: task.subjectId,
        date: action.date,
        startTime: null,
        endTime: null,
        minutes: action.minutes,
        completed: true,
        origin: action.origin,
      };
      return {
        ...state,
        sessions: [...state.sessions, session],
        tasks: state.tasks.map((t) =>
          t.id === task.id
            ? {
                ...t,
                actualMinutes: t.actualMinutes + action.minutes,
                // Bắt đầu học một việc "Cần làm" thì chuyển sang "Đang làm"
                status: t.status === 'todo' ? 'in_progress' : t.status,
              }
            : t,
        ),
      };
    }

    case 'availability/set':
      return { ...state, availability: action.availability };

    case 'schedule/set':
      return { ...state, schedule: action.schedule };

    case 'schedule/toggleSession': {
      const schedule = state.schedule;
      const planned = schedule?.sessions.find((s) => s.id === action.sessionId);
      if (!schedule || !planned || planned.completed === action.completed) return state;
      const task = state.tasks.find((t) => t.id === planned.taskId);
      if (!task) return state;

      const nextSchedule: StudySchedule = {
        ...schedule,
        sessions: schedule.sessions.map((s) => (s.id === planned.id ? { ...s, completed: action.completed } : s)),
      };

      if (action.completed) {
        // Ghi nhận giờ học thật (dùng chung id với phiên trong lịch để có thể hoàn tác)
        // Phiên xếp cho tương lai mà học sớm thì ghi vào hôm nay
        const logged: StudySession = { ...planned, completed: true, date: planned.date <= action.today ? planned.date : action.today };
        return {
          ...state,
          schedule: nextSchedule,
          sessions: [...state.sessions.filter((s) => s.id !== planned.id), logged],
          tasks: state.tasks.map((t) =>
            t.id === task.id
              ? { ...t, actualMinutes: t.actualMinutes + planned.minutes, status: t.status === 'todo' ? 'in_progress' : t.status }
              : t,
          ),
        };
      }

      // Hoàn tác: bỏ phiên đã ghi nhận và trừ lại số phút
      const hadLog = state.sessions.some((s) => s.id === planned.id);
      return {
        ...state,
        schedule: nextSchedule,
        sessions: state.sessions.filter((s) => s.id !== planned.id),
        tasks: hadLog
          ? state.tasks.map((t) => (t.id === task.id ? { ...t, actualMinutes: Math.max(0, t.actualMinutes - planned.minutes) } : t))
          : state.tasks,
      };
    }

    case 'event/add':
      return { ...state, events: [...state.events, action.event] };
    case 'event/update':
      return { ...state, events: state.events.map((e) => (e.id === action.event.id ? action.event : e)) };
    case 'event/delete':
      return { ...state, events: state.events.filter((e) => e.id !== action.id) };

    case 'user/setName':
      return { ...state, userName: action.name };

    case 'data/replace':
      return action.data;

    default:
      return state;
  }
}
