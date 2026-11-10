/**
 * Dữ liệu mẫu ban đầu (và cho nút "Reset Demo Data").
 * Mọi mốc thời gian được tính TƯƠNG ĐỐI so với thời điểm tạo, nên khi demo
 * luôn có task quá hạn, task đến hạn hôm nay, task còn xa… dù mở app vào ngày nào.
 *
 * Thời gian học thực tế (actualMinutes) của mỗi task = tổng các phiên học đã ghi nhận,
 * nên biểu đồ tuần và số liệu trên task luôn khớp nhau.
 */
import { DEFAULT_AVAILABILITY, DEFAULT_USER_NAME } from '../constants';
import type { AppData, CalendarEvent, Difficulty, Importance, StudySession, Subject, Task, TaskStatus } from '../types';
import { addDays, atTime, toDateKey } from '../utils/date';

const SUBJECTS: Subject[] = [
  {
    id: 'sub-db',
    name: 'Cơ sở dữ liệu',
    code: 'DB101',
    color: '#7FAE6A',
    difficulty: 'hard',
    description: 'SQL, chuẩn hóa dữ liệu, thiết kế ERD và truy vấn nâng cao.',
  },
  {
    id: 'sub-erp',
    name: 'Hệ thống hoạch định nguồn lực doanh nghiệp',
    code: 'ERP201',
    color: '#6E9FC9',
    difficulty: 'medium',
    description: 'Quy trình nghiệp vụ doanh nghiệp trên nền tảng ERP.',
  },
  {
    id: 'sub-sad',
    name: 'Phân tích thiết kế hệ thống',
    code: 'SAD202',
    color: '#D98CA0',
    difficulty: 'medium',
    description: 'UML, Use Case, sơ đồ hoạt động và đặc tả yêu cầu.',
  },
  {
    id: 'sub-mkt',
    name: 'Marketing Technology',
    code: 'MKT301',
    color: '#E0A458',
    difficulty: 'easy',
    description: 'Công cụ và nền tảng công nghệ trong marketing.',
  },
  {
    id: 'sub-web',
    name: 'Lập trình Web',
    code: 'WEB102',
    color: '#5FA8A0',
    difficulty: 'medium',
    description: 'HTML/CSS/JavaScript, React và xây dựng ứng dụng web.',
  },
];

interface TaskSeed {
  id: string;
  title: string;
  subjectId: string;
  description: string;
  /** [số ngày so với hôm nay, giờ, phút] */
  due: [number, number, number];
  estimatedMinutes: number;
  difficulty: Difficulty;
  importance: Importance;
  status: TaskStatus;
}

const TASK_SEEDS: TaskSeed[] = [
  { id: 'task-erp-report', title: 'Báo cáo phân tích quy trình mua hàng', subjectId: 'sub-erp', description: 'Phân tích quy trình Purchase-to-Pay và đề xuất cải tiến.', due: [-1, 23, 59], estimatedMinutes: 180, difficulty: 'medium', importance: 'high', status: 'in_progress' },
  { id: 'task-web-login', title: 'Hoàn thiện giao diện trang đăng nhập', subjectId: 'sub-web', description: 'Form đăng nhập responsive + kiểm tra dữ liệu đầu vào.', due: [0, 21, 0], estimatedMinutes: 90, difficulty: 'easy', importance: 'medium', status: 'todo' },
  { id: 'task-db-sql', title: 'Bài tập SQL – truy vấn lồng nhau', subjectId: 'sub-db', description: '5 câu truy vấn lồng nhau, GROUP BY và HAVING.', due: [2, 23, 59], estimatedMinutes: 180, difficulty: 'medium', importance: 'high', status: 'in_progress' },
  { id: 'task-sad-uml', title: 'Vẽ sơ đồ Use Case và Activity', subjectId: 'sub-sad', description: 'Cho hệ thống quản lý thư viện.', due: [3, 17, 0], estimatedMinutes: 150, difficulty: 'medium', importance: 'medium', status: 'in_progress' },
  { id: 'task-mkt-slide', title: 'Slide thuyết trình Marketing Automation', subjectId: 'sub-mkt', description: 'Nhóm 5 người, phần của mình: giới thiệu công cụ.', due: [5, 10, 0], estimatedMinutes: 120, difficulty: 'easy', importance: 'medium', status: 'todo' },
  { id: 'task-web-cart', title: 'Đồ án giữa kỳ – module giỏ hàng', subjectId: 'sub-web', description: 'Thêm/xóa sản phẩm, tính tổng tiền, lưu LocalStorage.', due: [6, 23, 59], estimatedMinutes: 300, difficulty: 'hard', importance: 'high', status: 'in_progress' },
  { id: 'task-erp-quiz', title: 'Ôn tập quiz chương 3', subjectId: 'sub-erp', description: 'Các module Sales, Inventory, Finance.', due: [9, 8, 0], estimatedMinutes: 90, difficulty: 'easy', importance: 'low', status: 'todo' },
  { id: 'task-db-erd', title: 'Thiết kế ERD cho đồ án nhóm', subjectId: 'sub-db', description: 'Hệ thống quản lý bán hàng: xác định thực thể và quan hệ.', due: [12, 23, 59], estimatedMinutes: 240, difficulty: 'hard', importance: 'high', status: 'todo' },
  { id: 'task-sad-read', title: 'Đọc tài liệu UML chương 5', subjectId: 'sub-sad', description: '', due: [-3, 23, 59], estimatedMinutes: 60, difficulty: 'easy', importance: 'low', status: 'completed' },
  { id: 'task-mkt-case', title: 'Nghiên cứu case study HubSpot', subjectId: 'sub-mkt', description: '', due: [-2, 18, 0], estimatedMinutes: 90, difficulty: 'easy', importance: 'medium', status: 'completed' },
  { id: 'task-db-ra', title: 'Bài tập đại số quan hệ', subjectId: 'sub-db', description: '', due: [-5, 23, 59], estimatedMinutes: 120, difficulty: 'medium', importance: 'medium', status: 'completed' },
];

/** [taskId, số ngày trước, số phút] – các phiên học đã diễn ra */
const SESSION_SEEDS: Array<[string, number, number]> = [
  ['task-db-sql', 0, 40],
  ['task-sad-uml', 1, 45],
  ['task-erp-report', 2, 30],
  ['task-erp-report', 4, 30],
  ['task-web-cart', 3, 60],
  ['task-web-cart', 5, 60],
  ['task-mkt-case', 3, 30],
  ['task-mkt-case', 4, 50],
  ['task-sad-read', 5, 35],
  ['task-sad-read', 6, 40],
  ['task-db-ra', 5, 70],
  ['task-db-ra', 6, 70],
];

export function createSeedData(now: Date = new Date()): AppData {
  const createdAt = addDays(now, -7).toISOString();

  const sessions: StudySession[] = SESSION_SEEDS.map(([taskId, daysAgo, minutes], i) => {
    const seed = TASK_SEEDS.find((t) => t.id === taskId)!;
    return {
      id: `ses-seed-${i + 1}`,
      taskId,
      subjectId: seed.subjectId,
      date: toDateKey(addDays(now, -daysAgo)),
      startTime: null,
      endTime: null,
      minutes,
      completed: true,
      origin: 'manual',
    };
  });

  const tasks: Task[] = TASK_SEEDS.map((seed) => {
    const actualMinutes = sessions.filter((s) => s.taskId === seed.id).reduce((sum, s) => sum + s.minutes, 0);
    const deadline = atTime(now, seed.due[0], seed.due[1], seed.due[2]).toISOString();
    return {
      id: seed.id,
      title: seed.title,
      subjectId: seed.subjectId,
      description: seed.description,
      deadline,
      estimatedMinutes: seed.estimatedMinutes,
      actualMinutes,
      difficulty: seed.difficulty,
      importance: seed.importance,
      status: seed.status,
      createdAt,
      completedAt: seed.status === 'completed' ? atTime(now, seed.due[0] - 1, 20, 0).toISOString() : null,
    };
  });

  return {
    subjects: SUBJECTS.map((s) => ({ ...s })),
    tasks,
    sessions,
    availability: { ...DEFAULT_AVAILABILITY, days: [...DEFAULT_AVAILABILITY.days], slots: DEFAULT_AVAILABILITY.slots.map((s) => ({ ...s })), daySlots: {}, dateOverrides: {} },
    schedule: null,
    events: createSeedEvents(now),
    userName: DEFAULT_USER_NAME,
  };
}

/** Sự kiện mẫu: lịch lên lớp lặp hằng tuần, một buổi họp nhóm buổi tối (chiếm giờ rảnh) và một sự kiện cả ngày. */
function createSeedEvents(now: Date): CalendarEvent[] {
  const day = (offset: number) => toDateKey(addDays(now, offset));
  const base = { location: '', description: '', repeat: 'none' as const, repeatUntil: null, allDay: false, blocksStudy: true };
  return [
    {
      ...base,
      id: 'evt-class-db',
      title: 'Lên lớp Cơ sở dữ liệu',
      date: day(0),
      startTime: '07:30',
      endTime: '10:30',
      color: '#5B8C5A',
      location: 'Phòng B2.04',
      repeat: 'weekly',
    },
    {
      ...base,
      id: 'evt-team',
      title: 'Họp nhóm đồ án Web',
      date: day(1),
      startTime: '19:00',
      endTime: '20:00',
      color: '#C9822B',
      location: 'Google Meet',
      description: 'Chia việc module giỏ hàng.',
    },
    {
      ...base,
      id: 'evt-club',
      title: 'Ngày hội CLB',
      date: day(3),
      startTime: '00:00',
      endTime: '23:59',
      allDay: true,
      blocksStudy: false,
      color: '#6E8FB5',
    },
  ];
}

/** Dữ liệu trống cho tài khoản mới */
export function createEmptyData(userName: string = DEFAULT_USER_NAME): AppData {
  return {
    subjects: [],
    tasks: [],
    sessions: [],
    availability: { ...DEFAULT_AVAILABILITY, days: [...DEFAULT_AVAILABILITY.days], slots: DEFAULT_AVAILABILITY.slots.map((s) => ({ ...s })), daySlots: {}, dateOverrides: {} },
    schedule: null,
    events: [],
    userName: userName.trim().slice(0, 30) || DEFAULT_USER_NAME,
  };
}
