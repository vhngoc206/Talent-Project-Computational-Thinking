/**
 * SMART STUDY SCHEDULER – Greedy Algorithm.
 *
 * Ý tưởng tham lam (greedy): luôn lấy nhiệm vụ có độ ưu tiên CAO NHẤT còn lại,
 * rồi nhét phần thời gian còn phải học của nó vào các khung giờ rảnh SỚM NHẤT còn trống.
 *
 *   1. Lấy các task chưa hoàn thành.
 *   2. Sắp xếp theo Priority Score (và deadline khi bằng điểm) – dùng lại rankTasks().
 *   3. Sinh các "khối rảnh" (free block) từ hôm nay theo ngày học + khung giờ của người dùng.
 *   4–6. Với từng task theo thứ tự ưu tiên: chia thành các phiên dài tối đa `sessionMinutes`,
 *        đặt vào khối rảnh sớm nhất; giữa hai phiên trong cùng khối có thời gian nghỉ `breakMinutes`.
 *   7. Mỗi khối có một "con trỏ" thời gian chỉ tiến lên ⇒ hai phiên không bao giờ trùng giờ.
 *   8. Phiên phải KẾT THÚC trước deadline ⇒ không bao giờ xếp sau deadline.
 *   9. Phần thời gian không xếp được được trả về trong `unscheduled` kèm lý do + cảnh báo.
 *
 * Hàm thuần: không đụng React/LocalStorage, mọi thứ (kể cả `now`) truyền vào ⇒ test được.
 */
import type { Availability, CalendarEvent, ScheduleStats, StudySchedule, StudySession, Task, UnscheduledTask } from '../types';
import { addDays, formatMinutes, MS_PER_DAY, MS_PER_MINUTE, startOfDay, toDateKey } from '../utils/date';
import { activeDays, slotsForDate } from '../utils/availability';
import { rankTasks } from './priorityScheduler';

/** Không tạo phiên ngắn hơn mức này (trừ khi phần còn lại của task vốn đã ngắn hơn) */
export const MIN_SESSION_MINUTES = 15;
/** Nhiệm vụ đã học đủ giờ dự kiến mà chưa tick hoàn thành thì xếp thêm phiên dài chừng này */
export const FINISHING_MINUTES = 30;
/** Lập lịch tối đa bao nhiêu ngày tính từ hôm nay */
export const MAX_HORIZON_DAYS = 28;
/** Làm tròn giờ bắt đầu lên bội số 5 phút cho dễ nhìn */
const ROUND_TO_MINUTES = 5;

/** Một khoảng thời gian rảnh liên tục [startMs, endMs) */
export interface FreeBlock {
  startMs: number;
  endMs: number;
}

export interface ScheduleOptions {
  now: Date;
  /** Số ngày lập lịch; mặc định: tới deadline xa nhất của các task chưa xong (tối đa 28) */
  horizonDays?: number;
  /** Các phiên đã có từ trước và cần giữ nguyên (ví dụ phiên đã học xong hôm nay) – chiếm chỗ trong lịch */
  keepSessions?: StudySession[];
  /** Khoảng thời gian bận (sự kiện trên Lịch: giờ lên lớp, đi làm…) – không xếp phiên học vào đây */
  busy?: Array<{ startMs: number; endMs: number }>;
  /** Các sự kiện tạo ra `busy` – chỉ dùng để tính chữ ký phát hiện lịch cũ */
  signatureEvents?: CalendarEvent[];
  /** Tạo id cho phiên học (mặc định tuần tự, xác định) */
  makeId?: (index: number) => string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** 'HH:mm' -> số phút từ 0h */
export function timeToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

function ceilToStep(ms: number, stepMinutes: number): number {
  const step = stepMinutes * MS_PER_MINUTE;
  return Math.ceil(ms / step) * step;
}

/** Số ngày cần xét: tới deadline xa nhất (làm tròn lên), giới hạn 1..MAX_HORIZON_DAYS */
export function defaultHorizonDays(tasks: Task[], now: Date): number {
  const pending = tasks.filter((t) => t.status !== 'completed');
  if (pending.length === 0) return 7;
  const latest = Math.max(...pending.map((t) => new Date(t.deadline).getTime()));
  const days = Math.ceil((latest - startOfDay(now).getTime()) / MS_PER_DAY);
  return Math.min(MAX_HORIZON_DAYS, Math.max(1, days));
}

/**
 * Bước 3: sinh các khối rảnh theo thứ tự thời gian.
 * Khung giờ trùng/chồng nhau được gộp lại; phần đã trôi qua của hôm nay bị cắt bỏ.
 */
/** Khung giờ của một ngày, đổi sang phút trong ngày và gộp các khung chồng lấn (vd 19:00–21:00 + 20:30–22:00 => 19:00–22:00) */
function mergedSlotsFor(availability: Availability, day: Date): Array<{ start: number; end: number }> {
  const slots = slotsForDate(availability, day)
    // Phiên luôn kết thúc trong ngày (muộn nhất 23:59) để giờ kết thúc không bị ghi thành "00:00" của chính ngày đó
    .map((s) => ({ start: timeToMinutes(s.start), end: Math.min(timeToMinutes(s.end), 23 * 60 + 59) }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const s of slots) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else merged.push({ ...s });
  }
  return merged;
}

export function buildFreeBlocks(availability: Availability, now: Date, horizonDays: number): FreeBlock[] {
  const earliest = ceilToStep(now.getTime(), ROUND_TO_MINUTES);
  const blocks: FreeBlock[] = [];
  for (let d = 0; d < horizonDays; d++) {
    const day = startOfDay(addDays(now, d));
    // Mỗi thứ trong tuần có khung giờ riêng; ngày đặc biệt thì dùng giờ của riêng ngày đó
    for (const s of mergedSlotsFor(availability, day)) {
      const startMs = Math.max(day.getTime() + s.start * MS_PER_MINUTE, earliest);
      const endMs = day.getTime() + s.end * MS_PER_MINUTE;
      if (endMs - startMs >= MIN_SESSION_MINUTES * MS_PER_MINUTE) blocks.push({ startMs, endMs });
    }
  }
  return blocks;
}

/** Bỏ khoảng [startMs, endMs) ra khỏi danh sách khối rảnh (dùng cho các phiên giữ lại). */
export function subtractInterval(blocks: FreeBlock[], startMs: number, endMs: number): FreeBlock[] {
  const out: FreeBlock[] = [];
  for (const b of blocks) {
    if (endMs <= b.startMs || startMs >= b.endMs) {
      out.push(b);
      continue;
    }
    if (startMs > b.startMs) out.push({ startMs: b.startMs, endMs: startMs });
    if (endMs < b.endMs) out.push({ startMs: endMs, endMs: b.endMs });
  }
  return out;
}

function sessionInterval(s: StudySession): FreeBlock | null {
  if (!s.startTime || !s.endTime) return null;
  const day = new Date(`${s.date}T00:00:00`).getTime();
  return { startMs: day + timeToMinutes(s.startTime) * MS_PER_MINUTE, endMs: day + timeToMinutes(s.endTime) * MS_PER_MINUTE };
}

/** Chuỗi đại diện cho dữ liệu đầu vào. Đổi task/thời gian rảnh => chữ ký đổi => lịch được báo là "đã cũ". */
export function computeScheduleSignature(tasks: Task[], availability: Availability, events: CalendarEvent[] = []): string {
  const taskPart = tasks
    .filter((t) => t.status !== 'completed')
    .map((t) => [t.id, t.deadline, t.estimatedMinutes, t.importance, t.difficulty].join('|'))
    .sort()
    .join(';');
  const eventPart = events
    .filter((e) => e.blocksStudy)
    .map((e) => [e.id, e.date, e.startTime, e.endTime, e.allDay, e.repeat, e.repeatUntil].join('|'))
    .sort()
    .join(';');
  const text = `${taskPart}#${JSON.stringify(availability)}#${eventPart}`;
  // Băm djb2 cho gọn
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

/** Số phút còn phải học của một task */
export const remainingMinutesOf = (t: Task) => Math.max(0, t.estimatedMinutes - t.actualMinutes);

/** Thuật toán chính. */
export function generateSchedule(tasks: Task[], availability: Availability, options: ScheduleOptions): StudySchedule {
  const { now } = options;
  const horizonDays = Math.min(MAX_HORIZON_DAYS, Math.max(1, options.horizonDays ?? defaultHorizonDays(tasks, now)));
  const makeId = options.makeId ?? ((i: number) => `sch-${now.getTime().toString(36)}-${i}`);
  const sessionMs = availability.sessionMinutes * MS_PER_MINUTE;
  const breakMs = availability.breakMinutes * MS_PER_MINUTE;
  const horizonEndMs = startOfDay(addDays(now, horizonDays)).getTime();

  // Bước 3: khối rảnh, trừ đi giờ bận (sự kiện) và các phiên được giữ lại
  let blocks = buildFreeBlocks(availability, now, horizonDays);
  for (const b of options.busy ?? []) blocks = subtractInterval(blocks, b.startMs, b.endMs);
  const capacityMinutes = Math.round(blocks.reduce((s, b) => s + (b.endMs - b.startMs), 0) / MS_PER_MINUTE);
  const kept = options.keepSessions ?? [];
  for (const s of kept) {
    const iv = sessionInterval(s);
    if (iv) blocks = subtractInterval(blocks, iv.startMs, iv.endMs + breakMs);
  }
  // Mỗi khối có con trỏ "cursor": thời điểm sớm nhất còn trống trong khối
  const cursors = blocks.map((b) => ({ ...b, cursor: b.startMs }));

  // Bước 1–2: task chưa xong, theo thứ tự Priority Engine
  const ranked = rankTasks(tasks, now);
  const sessions: StudySession[] = [];
  const unscheduled: UnscheduledTask[] = [];
  let requiredMinutes = 0;
  let overdueCount = 0;

  // Phút đã được người dùng tự xếp (phiên ghim, chưa học) cho từng task – không xếp trùng phần đó nữa
  const pinnedByTask = new Map<string, number>();
  for (const s of kept) if (!s.completed) pinnedByTask.set(s.taskId, (pinnedByTask.get(s.taskId) ?? 0) + s.minutes);

  for (const { task } of ranked) {
    // Đã học đủ thời gian ước tính nhưng chưa tick hoàn thành => vẫn xếp thêm một phiên hoàn thiện
    const pinned = pinnedByTask.get(task.id) ?? 0;
    const base = remainingMinutesOf(task) || (pinned > 0 ? 0 : FINISHING_MINUTES);
    requiredMinutes += base;
    let remaining = Math.max(0, base - pinned) * MS_PER_MINUTE;

    const deadlineMs = new Date(task.deadline).getTime();
    if (deadlineMs <= now.getTime()) {
      overdueCount++;
      unscheduled.push({
        taskId: task.id,
        missingMinutes: remaining / MS_PER_MINUTE,
        reason: 'Đã quá hạn – không thể xếp lịch trước deadline. Hãy làm ngay hoặc dời deadline.',
      });
      continue;
    }
    if (remaining <= 0) continue; // các phiên bạn tự chọn giờ đã đủ cho task này

    // Bước 4–8: đổ dần vào các khối sớm nhất
    for (const block of cursors) {
      if (remaining <= 0) break;
      if (block.cursor >= deadlineMs) break; // các khối sau còn muộn hơn => dừng
      while (remaining > 0) {
        const start = block.cursor;
        const limitEnd = Math.min(block.endMs, deadlineMs); // không vượt quá khối và deadline
        const available = limitEnd - start;
        const minNeeded = Math.min(MIN_SESSION_MINUTES * MS_PER_MINUTE, remaining);
        if (available < minNeeded) break;

        // Độ dài phiên = min(độ dài phiên tối đa, phần còn lại của task, chỗ trống), làm tròn xuống theo phút
        let length = Math.floor(Math.min(sessionMs, remaining, available) / MS_PER_MINUTE) * MS_PER_MINUTE;
        // Phần dư quá ngắn (< 15 phút) thì gộp luôn vào phiên này thay vì tạo một phiên lẻ 5–10 phút
        const leftover = remaining - length;
        if (leftover > 0 && leftover < MIN_SESSION_MINUTES * MS_PER_MINUTE && available >= remaining) length = remaining;
        const startDate = new Date(start);
        const endDate = new Date(start + length);
        sessions.push({
          id: makeId(sessions.length),
          taskId: task.id,
          subjectId: task.subjectId,
          date: toDateKey(startDate),
          startTime: hhmm(startDate),
          endTime: hhmm(endDate),
          minutes: length / MS_PER_MINUTE,
          completed: false,
          origin: 'scheduler',
        });
        remaining -= length;
        block.cursor = start + length + breakMs; // nghỉ giữa phiên
      }
    }

    // Bước 9: thiếu thời gian
    if (remaining > 0) {
      const missing = Math.round(remaining / MS_PER_MINUTE);
      unscheduled.push({
        taskId: task.id,
        missingMinutes: missing,
        reason:
          deadlineMs > horizonEndMs
            ? `Hết khung giờ rảnh trong ${horizonDays} ngày tới – còn thiếu ${formatMinutes(missing)}.`
            : `Không đủ thời gian rảnh trước deadline – còn thiếu ${formatMinutes(missing)}.`,
      });
    }
  }

  sessions.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  const scheduledMinutes = sessions.reduce((s, x) => s + x.minutes, 0);
  const stats: ScheduleStats = { requiredMinutes: Math.round(requiredMinutes), scheduledMinutes, capacityMinutes, horizonDays };

  return {
    generatedAt: now.toISOString(),
    sessions,
    unscheduled,
    warnings: buildWarnings(stats, unscheduled.length, overdueCount, availability, blocks.length),
    stats,
    inputSignature: computeScheduleSignature(tasks, availability, options.signatureEvents),
  };
}

function buildWarnings(
  stats: ScheduleStats,
  unscheduledCount: number,
  overdueCount: number,
  availability: Availability,
  blockCount: number,
): string[] {
  const warnings: string[] = [];
  if (activeDays(availability).length === 0 && !Object.values(availability.dateOverrides ?? {}).some((l) => l.length > 0)) {
    warnings.push('Bạn chưa chọn ngày học hoặc khung giờ rảnh nào nên không thể xếp lịch.');
  } else if (blockCount === 0) {
    warnings.push(`Không còn khung giờ rảnh nào trong ${stats.horizonDays} ngày tới.`);
  }
  if (stats.requiredMinutes > stats.capacityMinutes) {
    warnings.push(
      `Khối lượng cần học (${formatMinutes(stats.requiredMinutes)}) vượt quá thời gian rảnh (${formatMinutes(stats.capacityMinutes)}) trong ${stats.horizonDays} ngày tới.`,
    );
  }
  if (overdueCount > 0) warnings.push(`${overdueCount} nhiệm vụ đã quá hạn nên không được xếp lịch.`);
  const lacking = unscheduledCount - overdueCount;
  if (lacking > 0) warnings.push(`${lacking} nhiệm vụ chưa được phân bổ đủ thời gian trước deadline.`);
  return warnings;
}
