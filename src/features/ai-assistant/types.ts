import type { AiMode } from '../../services/aiService';
import type { Difficulty, Importance } from '../../types';

/** Kết quả AI Task Analyzer – bản nháp để người dùng XÁC NHẬN trước khi lưu */
export interface TaskDraft {
  title: string;
  /** id môn học có thật trong dữ liệu; null nếu không nhận diện được */
  subjectId: string | null;
  /** ISO 8601; null nếu không nhận diện được */
  deadline: string | null;
  difficulty: Difficulty;
  importance: Importance;
  estimatedMinutes: number;
  description: string;
  /** Giải thích AI/Demo đã suy luận như thế nào */
  notes: string[];
}

/** Một mục trong kế hoạch, luôn gắn với một task có thật */
export interface PlanItem {
  taskId: string;
  text: string;
}

/** Kết quả AI Study Planner */
export interface StudyPlan {
  summary: string;
  focus: PlanItem[];
  risks: PlanItem[];
  allocation: PlanItem[];
  tips: string[];
  /** Số mục AI trả về nhưng bị loại vì tham chiếu task không tồn tại */
  droppedItems: number;
}

/** Mọi kết quả đều ghi rõ nguồn: Gemini thật hay Demo Mode */
export interface AiResult<T> {
  source: AiMode;
  /** Model Gemini đã trả lời (chỉ có khi source = 'gemini') */
  model?: string;
  data: T;
}
