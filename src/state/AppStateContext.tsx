/**
 * Provider trung tâm: giữ AppData bằng useReducer, tự lưu vào LocalStorage mỗi khi dữ liệu đổi,
 * và cung cấp các "actions" cấp cao (tạo id, mốc thời gian…) cho giao diện.
 */
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { useToast } from '../components/ui/Toast';
import { createEmptyData, createSeedData } from '../services/seedData';
import { loadAppData, saveAppData } from '../services/storageService';
import { generateSchedule, MAX_HORIZON_DAYS } from '../algorithms/greedyScheduler';
import { busyIntervals, dateAt } from '../utils/events';
import type { AppData, Availability, CalendarEvent, CalendarEventInput, StudySession, SessionOrigin, StudySchedule, Subject, SubjectInput, Task, TaskInput, TaskStatus } from '../types';
import { addDays, toDateKey } from '../utils/date';
import { createId } from '../utils/id';
import { sessionEnd } from '../features/scheduler/autoSchedule';
import { appReducer, normalizeCompletion } from './appReducer';

export interface AppActions {
  addSubject: (input: SubjectInput) => Subject;
  updateSubject: (id: string, input: SubjectInput) => void;
  deleteSubject: (id: string) => void;
  addTask: (input: TaskInput) => Task;
  updateTask: (id: string, input: TaskInput) => void;
  deleteTask: (id: string) => void;
  setTaskStatus: (id: string, status: TaskStatus) => void;
  /** Ghi nhận một phiên học thực tế (Pomodoro/thủ công) vào task */
  logStudy: (taskId: string, minutes: number, origin?: SessionOrigin) => void;
  setUserName: (name: string) => void;
  resetDemoData: () => void;
  /** Xóa toàn bộ môn học, nhiệm vụ, sự kiện… (giữ tên hiển thị) */
  clearAllData: () => void;
  /** Thay toàn bộ dữ liệu (dùng khi chuyển dữ liệu cũ vào tài khoản) */
  replaceData: (data: AppData) => void;
  /** Lưu thời gian rảnh (đầu vào của Greedy Scheduler) */
  setAvailability: (availability: Availability) => void;
  /** Chạy Greedy Scheduler trên dữ liệu hiện tại và lưu lịch */
  generateSchedule: (availabilityOverride?: Availability) => StudySchedule;
  clearSchedule: () => void;
  toggleScheduleSession: (sessionId: string, completed: boolean) => void;
  /** Tự chọn giờ cho một phiên học (sửa phiên có sẵn khi có `id`, hoặc thêm mới). Trả về thông báo lỗi hoặc null */
  setPinnedSession: (input: PinnedSessionInput) => string | null;
  /** Bỏ phiên tự chọn giờ – lịch tự động sẽ xếp lại phần thời gian đó */
  removePinnedSession: (sessionId: string) => void;
  addEvent: (input: CalendarEventInput) => CalendarEvent;
  updateEvent: (id: string, input: CalendarEventInput) => void;
  deleteEvent: (id: string) => void;
}

export interface PinnedSessionInput {
  id?: string;
  taskId: string;
  /** 'YYYY-MM-DD' */
  date: string;
  startTime: string;
  endTime: string;
}

const toMin = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));

/** Kiểm tra phiên tự chọn giờ: đúng định dạng, chưa qua, dài ≥ 15 phút, không trùng phiên đã cố định khác */
export function validatePinnedSession(data: AppData, input: PinnedSessionInput, now: Date): string | null {
  const task = data.tasks.find((t) => t.id === input.taskId);
  if (!task) return 'Chọn nhiệm vụ.';
  if (task.status === 'completed') return 'Nhiệm vụ này đã hoàn thành.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return 'Chọn ngày.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.endTime)) return 'Giờ không hợp lệ.';
  if (toMin(input.endTime) - toMin(input.startTime) < 15) return 'Phiên học cần dài ít nhất 15 phút và kết thúc sau giờ bắt đầu.';
  if (dateAt(input.date, input.endTime).getTime() <= now.getTime()) return 'Khung giờ này đã qua – hãy chọn giờ sắp tới.';
  const clash = (data.schedule?.sessions ?? []).find(
    (x) =>
      x.id !== input.id &&
      (x.pinned || x.completed) &&
      x.date === input.date &&
      x.startTime &&
      x.endTime &&
      toMin(input.startTime) < toMin(x.endTime) &&
      toMin(x.startTime) < toMin(input.endTime),
  );
  if (clash) return `Trùng giờ với phiên ${clash.startTime}–${clash.endTime} đã có.`;
  return null;
}

/**
 * Tạo lại lịch học từ dữ liệu hiện tại. Giữ nguyên:
 *  - phiên đã học xong từ hôm nay trở đi,
 *  - phiên bạn tự chọn giờ (ghim) chưa tới giờ kết thúc và task chưa xong.
 * Phần còn lại do Greedy Scheduler xếp vào giờ rảnh còn trống.
 */
export function rebuildSchedule(current: AppData, now: Date): StudySchedule {
  const today = toDateKey(now);
  const doneTasks = new Set(current.tasks.filter((t) => t.status === 'completed').map((t) => t.id));
  const keepSessions = (current.schedule?.sessions ?? []).filter(
    (x) =>
      (x.completed && x.date >= today) ||
      (x.pinned && !x.completed && !doneTasks.has(x.taskId) && x.endTime !== null && sessionEnd(x).getTime() > now.getTime()),
  );
  const fresh = generateSchedule(current.tasks, current.availability, {
    now,
    keepSessions,
    // Giờ có sự kiện trên Lịch (blocksStudy) được coi là bận
    busy: busyIntervals(current.events, now, addDays(now, MAX_HORIZON_DAYS + 1)),
    signatureEvents: current.events,
  });
  return {
    ...fresh,
    sessions: [...keepSessions, ...fresh.sessions].sort((a, b) => (a.date + (a.startTime ?? '')).localeCompare(b.date + (b.startTime ?? ''))),
  };
}

interface AppContextValue {
  data: AppData;
  actions: AppActions;
  /** false nếu không ghi được LocalStorage (đầy/bị chặn) – dữ liệu chỉ còn trong phiên làm việc */
  storageOk: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
  /** Dữ liệu ban đầu lấy từ tài khoản (đăng nhập). Không truyền => đọc LocalStorage như cũ */
  initialData?: AppData;
  /** Lưu dữ liệu lên tài khoản (thay cho LocalStorage) */
  persist?: (data: AppData) => Promise<void>;
}

export function AppStateProvider({ children, initialData, persist }: ProviderProps) {
  const toast = useToast();
  const [initial] = useState(() => (initialData ? { data: initialData, source: 'storage' as const, droppedItems: 0 } : loadAppData()));
  const [data, dispatch] = useReducer(appReducer, initial.data);
  const [storageOk, setStorageOk] = useState(true);
  // Bản dữ liệu mới nhất cho các action cần đọc state (ví dụ chạy thuật toán lập lịch)
  const dataRef = useRef(data);
  dataRef.current = data;

  // Thông báo một lần khi dữ liệu cũ bị hỏng / có phần tử bị loại (ref chặn gọi lặp do StrictMode ở chế độ dev)
  const notified = useRef(false);
  useEffect(() => {
    if (notified.current) return;
    notified.current = true;
    if (initial.source === 'recovered') toast('Dữ liệu đã lưu bị lỗi nên được thay bằng dữ liệu mẫu (bản hỏng được sao lưu).', 'info');
    else if (initial.droppedItems > 0) toast(`Đã bỏ qua ${initial.droppedItems} mục dữ liệu không hợp lệ khi tải.`, 'info');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lưu tự động mỗi lần dữ liệu thay đổi: lên tài khoản (gộp các thay đổi liên tiếp trong 0,8 giây) hoặc LocalStorage
  const persistRef = useRef(persist);
  persistRef.current = persist;
  const firstRender = useRef(true);
  useEffect(() => {
    const save = persistRef.current;
    if (!save) {
      setStorageOk(saveAppData(data));
      return;
    }
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const id = window.setTimeout(() => {
      save(data).then(
        () => setStorageOk(true),
        () => setStorageOk(false),
      );
    }, 800);
    return () => window.clearTimeout(id);
  }, [data]);

  const actions = useMemo<AppActions>(
    () => ({
      addSubject(input) {
        const subject: Subject = { ...input, id: createId('sub'), name: input.name.trim(), code: input.code.trim(), description: input.description.trim() };
        dispatch({ type: 'subject/add', subject });
        return subject;
      },
      updateSubject(id, input) {
        dispatch({
          type: 'subject/update',
          subject: { ...input, id, name: input.name.trim(), code: input.code.trim(), description: input.description.trim() },
        });
      },
      deleteSubject: (id) => dispatch({ type: 'subject/delete', id }),

      addTask(input) {
        const now = new Date().toISOString();
        const task = normalizeCompletion(
          { ...input, title: input.title.trim(), description: input.description.trim(), id: createId('task'), createdAt: now, completedAt: null },
          now,
        );
        dispatch({ type: 'task/add', task });
        return task;
      },
      updateTask(id, input) {
        const now = new Date().toISOString();
        // completedAt thật sự do reducer quyết định (giữ mốc cũ nếu đã hoàn thành trước đó)
        dispatch({
          type: 'task/update',
          now,
          task: { ...input, title: input.title.trim(), description: input.description.trim(), id, createdAt: '', completedAt: null },
        });
      },
      deleteTask: (id) => dispatch({ type: 'task/delete', id }),
      setTaskStatus: (id, status) => dispatch({ type: 'task/setStatus', id, status, now: new Date().toISOString() }),

      logStudy(taskId, minutes, origin = 'pomodoro') {
        dispatch({ type: 'study/log', sessionId: createId('ses'), taskId, minutes, date: toDateKey(new Date()), origin });
      },
      setUserName: (name) => dispatch({ type: 'user/setName', name: name.trim() || 'bạn' }),
      resetDemoData: () => dispatch({ type: 'data/replace', data: { ...createSeedData(new Date()), userName: dataRef.current.userName } }),
      replaceData: (next) => dispatch({ type: 'data/replace', data: next }),
      clearAllData: () => dispatch({ type: 'data/replace', data: createEmptyData(dataRef.current.userName) }),

      setAvailability: (availability) => dispatch({ type: 'availability/set', availability }),
      generateSchedule(availabilityOverride) {
        const current = availabilityOverride ? { ...dataRef.current, availability: availabilityOverride } : dataRef.current;
        const schedule = rebuildSchedule(current, new Date());
        dispatch({ type: 'schedule/set', schedule });
        return schedule;
      },
      setPinnedSession(input) {
        const current = dataRef.current;
        const now = new Date();
        const error = validatePinnedSession(current, input, now);
        if (error) return error;
        const task = current.tasks.find((t) => t.id === input.taskId)!;
        const [sh, sm] = input.startTime.split(':').map(Number);
        const [eh, em] = input.endTime.split(':').map(Number);
        const session: StudySession = {
          id: input.id ?? createId('pin'),
          taskId: task.id,
          subjectId: task.subjectId,
          date: input.date,
          startTime: input.startTime,
          endTime: input.endTime,
          minutes: eh * 60 + em - (sh * 60 + sm),
          completed: false,
          origin: 'scheduler',
          pinned: true,
        };
        const base = current.schedule ?? rebuildSchedule(current, now);
        const sessions = [...base.sessions.filter((x) => x.id !== session.id), session];
        // Xếp lại phần còn lại xung quanh phiên bạn vừa chọn
        dispatch({ type: 'schedule/set', schedule: rebuildSchedule({ ...current, schedule: { ...base, sessions } }, now) });
        return null;
      },
      removePinnedSession(sessionId) {
        const current = dataRef.current;
        if (!current.schedule) return;
        const sessions = current.schedule.sessions.filter((x) => x.id !== sessionId);
        dispatch({ type: 'schedule/set', schedule: rebuildSchedule({ ...current, schedule: { ...current.schedule, sessions } }, new Date()) });
      },
      clearSchedule: () => dispatch({ type: 'schedule/set', schedule: null }),
      toggleScheduleSession: (sessionId, completed) =>
        dispatch({ type: 'schedule/toggleSession', sessionId, completed, today: toDateKey(new Date()) }),

      addEvent(input) {
        const event: CalendarEvent = { ...input, id: createId('evt'), title: input.title.trim(), location: input.location.trim(), description: input.description.trim() };
        dispatch({ type: 'event/add', event });
        return event;
      },
      updateEvent: (id, input) =>
        dispatch({ type: 'event/update', event: { ...input, id, title: input.title.trim(), location: input.location.trim(), description: input.description.trim() } }),
      deleteEvent: (id) => dispatch({ type: 'event/delete', id }),
    }),
    [],
  );

  const value = useMemo(() => ({ data, actions, storageOk }), [data, actions, storageOk]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState phải được dùng bên trong <AppStateProvider>');
  return ctx;
}
