/**
 * SMART PRIORITY ENGINE – Priority Scheduling + điểm ưu tiên có trọng số.
 *
 *   Priority Score = 0.4 × Deadline Score + 0.3 × Importance Score + 0.3 × Difficulty Score
 *
 * - Deadline Score (1–3): >7 ngày = 1 · 3–7 ngày = 2 · <3 ngày hoặc quá hạn = 3
 * - Importance Score: Low = 1, Medium = 2, High = 3
 * - Difficulty Score: Easy = 1, Medium = 2, Hard = 3
 *
 * Sắp xếp giảm dần theo điểm; bằng điểm thì deadline gần hơn đứng trước.
 * Task đã hoàn thành không tham gia xếp hạng.
 *
 * File này là hàm thuần (không phụ thuộc React/LocalStorage) nên test độc lập được.
 */
import type { Difficulty, Importance, Task } from '../types';
import { daysUntil, formatCountdown } from '../utils/date';

export const WEIGHTS = { deadline: 0.4, importance: 0.3, difficulty: 0.3 } as const;

export const IMPORTANCE_SCORE: Record<Importance, number> = { low: 1, medium: 2, high: 3 };
export const DIFFICULTY_SCORE: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };

/** Ngưỡng deadline (ngày) – dùng chung cho điểm số và màu cảnh báo trên giao diện */
export const URGENT_DAYS = 3;
export const SOON_DAYS = 7;

export type DeadlineScore = 1 | 2 | 3;
export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';

export interface PriorityResult {
  task: Task;
  /** Điểm cuối cùng (làm tròn 2 chữ số, khoảng 1.00 – 3.00) */
  score: number;
  deadlineScore: DeadlineScore;
  importanceScore: number;
  difficultyScore: number;
  /** Số ngày còn lại (âm nếu quá hạn) */
  daysLeft: number;
  level: PriorityLevel;
  /** Giải thích vì sao task có mức ưu tiên này */
  reasons: string[];
}

/** Chuẩn hóa số ngày còn lại về thang 1–3. */
export function getDeadlineScore(daysLeft: number): DeadlineScore {
  if (daysLeft < URGENT_DAYS) return 3; // gồm cả quá hạn (âm)
  if (daysLeft <= SOON_DAYS) return 2;
  return 1;
}

export function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getPriorityLevel(score: number): PriorityLevel {
  if (score >= 2.5) return 'critical';
  if (score >= 2.0) return 'high';
  if (score >= 1.5) return 'medium';
  return 'low';
}

export const PRIORITY_LEVEL_LABEL: Record<PriorityLevel, string> = {
  critical: 'Rất cao',
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp',
};

/** Tính điểm ưu tiên cho MỘT task tại thời điểm `now`. */
export function calculatePriority(task: Task, now: Date): PriorityResult {
  const daysLeft = daysUntil(task.deadline, now);
  const deadlineScore = getDeadlineScore(daysLeft);
  const importanceScore = IMPORTANCE_SCORE[task.importance];
  const difficultyScore = DIFFICULTY_SCORE[task.difficulty];

  const score = roundScore(
    WEIGHTS.deadline * deadlineScore +
      WEIGHTS.importance * importanceScore +
      WEIGHTS.difficulty * difficultyScore,
  );

  return {
    task,
    score,
    deadlineScore,
    importanceScore,
    difficultyScore,
    daysLeft,
    level: getPriorityLevel(score),
    reasons: buildReasons(task, daysLeft, deadlineScore),
  };
}

function buildReasons(task: Task, daysLeft: number, deadlineScore: DeadlineScore): string[] {
  const reasons: string[] = [];

  if (daysLeft < 0) reasons.push(`${formatCountdown(daysLeft)} – cần xử lý ngay`);
  else if (deadlineScore === 3) reasons.push(`Deadline rất gần (${formatCountdown(daysLeft).toLowerCase()})`);
  else if (deadlineScore === 2) reasons.push(`Deadline trong tuần này (${formatCountdown(daysLeft).toLowerCase()})`);
  else reasons.push(`Deadline còn xa (${formatCountdown(daysLeft).toLowerCase()})`);

  if (task.importance === 'high') reasons.push('Mức độ quan trọng cao');
  else if (task.importance === 'medium') reasons.push('Mức độ quan trọng trung bình');
  else reasons.push('Mức độ quan trọng thấp');

  if (task.difficulty === 'hard') reasons.push('Độ khó cao – cần nhiều thời gian tập trung');
  else if (task.difficulty === 'medium') reasons.push('Độ khó trung bình');
  else reasons.push('Độ khó thấp – có thể hoàn thành nhanh');

  return reasons;
}

/**
 * Xếp hạng các task CHƯA hoàn thành.
 * 1) Điểm ưu tiên giảm dần  2) Bằng điểm: deadline gần hơn trước
 * 3) Vẫn bằng: tạo trước đứng trước, rồi theo id (để kết quả luôn xác định)
 */
export function rankTasks(tasks: Task[], now: Date): PriorityResult[] {
  return tasks
    .filter((t) => t.status !== 'completed')
    .map((t) => calculatePriority(t, now))
    .sort((a, b) => {
      // So sánh bằng số nguyên (score × 100) để tránh sai số số thực
      const diff = Math.round(b.score * 100) - Math.round(a.score * 100);
      if (diff !== 0) return diff;
      const byDeadline = new Date(a.task.deadline).getTime() - new Date(b.task.deadline).getTime();
      if (byDeadline !== 0) return byDeadline;
      const byCreated = new Date(a.task.createdAt).getTime() - new Date(b.task.createdAt).getTime();
      if (byCreated !== 0) return byCreated;
      return a.task.id.localeCompare(b.task.id);
    });
}

/** Mức cảnh báo màu cho deadline: đỏ / cam / xanh (và 'done' cho task đã xong) */
export type DeadlineUrgency = 'danger' | 'warning' | 'safe' | 'done';

export function getDeadlineUrgency(task: Pick<Task, 'deadline' | 'status'>, now: Date): DeadlineUrgency {
  if (task.status === 'completed') return 'done';
  const daysLeft = daysUntil(task.deadline, now);
  if (daysLeft < URGENT_DAYS) return 'danger'; // quá hạn hoặc sắp đến hạn
  if (daysLeft <= SOON_DAYS) return 'warning'; // gần đến hạn
  return 'safe';
}

export function isOverdue(task: Pick<Task, 'deadline' | 'status'>, now: Date): boolean {
  return task.status !== 'completed' && new Date(task.deadline).getTime() < now.getTime();
}
