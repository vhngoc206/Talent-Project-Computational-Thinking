/**
 * Ba chức năng AI của ứng dụng. Mỗi hàm:
 *  - mode 'gemini': gọi Gemini qua aiService với ngữ cảnh dữ liệu thật, rồi KIỂM TRA kết quả
 *    (môn học/task phải tồn tại, enum đúng, số hợp lệ) trước khi trả về giao diện;
 *  - mode 'demo'  : dùng logic dự phòng, kết quả gắn nhãn source = 'demo'.
 */
import { DIFFICULTY_OPTIONS, IMPORTANCE_OPTIONS } from '../../constants';
import { generateJson, generateText, getAiMode, type AiMode, type ChatTurn } from '../../services/aiService';
import type { AppData, Difficulty, Importance } from '../../types';
import { buildAiContext, localNowText } from './aiContext';
import { answerDemoQuestion, buildDemoPlan } from './demoAdvisor';
import { parseTaskDemo } from './demoTaskParser';
import { computeInsights } from './studyInsights';
import type { AiResult, PlanItem, StudyPlan, TaskDraft } from './types';

const BASE_RULES = `Bạn là "SmartStudy AI", trợ lý lập kế hoạch học tập cho sinh viên đại học Việt Nam.
Quy tắc bắt buộc:
- Luôn trả lời bằng tiếng Việt, ngắn gọn, thân thiện, thực tế.
- CHỈ dùng dữ liệu trong phần NGỮ CẢNH. Không bịa ra môn học, nhiệm vụ, deadline, điểm số hay lịch không có trong dữ liệu.
- Nếu dữ liệu không đủ để trả lời, hãy nói rõ là không có dữ liệu.
- Điểm ưu tiên (priorityScore, thang 1–3) và mô phỏng lịch (greedySchedulerSimulation) do thuật toán của ứng dụng tính – hãy dựa vào chúng.`;

// ================= A. AI TASK ANALYZER =================
const TASK_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: 'Tên nhiệm vụ ngắn gọn' },
    subjectId: { type: 'STRING', nullable: true, description: 'id của môn trong danh sách, hoặc null nếu không khớp' },
    deadline: { type: 'STRING', nullable: true, description: "Giờ địa phương dạng 'YYYY-MM-DDTHH:mm', hoặc null" },
    difficulty: { type: 'STRING', enum: ['easy', 'medium', 'hard'] },
    importance: { type: 'STRING', enum: ['low', 'medium', 'high'] },
    estimatedMinutes: { type: 'INTEGER' },
    description: { type: 'STRING' },
    notes: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Giải thích ngắn cách suy luận từng trường' },
  },
  required: ['title', 'subjectId', 'deadline', 'difficulty', 'importance', 'estimatedMinutes', 'description', 'notes'],
};

interface RawTaskDraft {
  title?: unknown;
  subjectId?: unknown;
  deadline?: unknown;
  difficulty?: unknown;
  importance?: unknown;
  estimatedMinutes?: unknown;
  description?: unknown;
  notes?: unknown;
}

/** Kiểm tra & làm sạch kết quả Gemini: không chấp nhận môn học không tồn tại, enum/số sai. */
export function sanitizeTaskDraft(raw: RawTaskDraft, data: AppData, sourceText: string): TaskDraft {
  const notes = Array.isArray(raw.notes) ? raw.notes.filter((n): n is string => typeof n === 'string').slice(0, 8) : [];
  const subjectId = typeof raw.subjectId === 'string' && data.subjects.some((s) => s.id === raw.subjectId) ? raw.subjectId : null;
  if (raw.subjectId && !subjectId) notes.push('AI đề xuất một môn không có trong danh sách nên đã bị bỏ – hãy chọn môn trong form.');

  let deadline: string | null = null;
  if (typeof raw.deadline === 'string') {
    const d = new Date(raw.deadline);
    if (!Number.isNaN(d.getTime())) deadline = d.toISOString();
  }
  const minutes = typeof raw.estimatedMinutes === 'number' && Number.isFinite(raw.estimatedMinutes) ? raw.estimatedMinutes : 60;

  return {
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 120) : 'Nhiệm vụ mới',
    subjectId,
    deadline,
    difficulty: DIFFICULTY_OPTIONS.includes(raw.difficulty as Difficulty) ? (raw.difficulty as Difficulty) : 'medium',
    importance: IMPORTANCE_OPTIONS.includes(raw.importance as Importance) ? (raw.importance as Importance) : 'medium',
    estimatedMinutes: Math.min(2400, Math.max(5, Math.round(minutes / 5) * 5)),
    description: typeof raw.description === 'string' ? raw.description.slice(0, 500) : sourceText.slice(0, 500),
    notes,
  };
}

export async function analyzeTask(text: string, data: AppData, now: Date, mode: AiMode = getAiMode()): Promise<AiResult<TaskDraft>> {
  if (mode === 'demo') return { source: 'demo', data: parseTaskDemo(text, data.subjects, now) };

  const { value: raw, model } = await generateJson<RawTaskDraft>({
    systemInstruction: `${BASE_RULES}
Nhiệm vụ: phân tích câu mô tả bài tập của sinh viên thành dữ liệu có cấu trúc.
- subjectId phải là một "id" trong danh sách môn học, hoặc null nếu không chắc.
- Quy đổi thời gian tương đối ("thứ Sáu tuần này", "ngày mai"…) dựa trên thời điểm hiện tại. Không nêu giờ => 23:59.
- Không nêu thời lượng => ước tính hợp lý theo độ khó. Mức quan trọng là gợi ý của bạn nếu người dùng không nói.`,
    turns: [
      {
        role: 'user',
        text: `NGỮ CẢNH
Thời điểm hiện tại: ${localNowText(now)}
Môn học: ${JSON.stringify(data.subjects.map((s) => ({ id: s.id, code: s.code, name: s.name, difficulty: s.difficulty })))}

CÂU CỦA SINH VIÊN:
"""${text}"""`,
      },
    ],
    responseSchema: TASK_SCHEMA,
  });
  return { source: 'gemini', model, data: sanitizeTaskDraft(raw, data, text) };
}

// ================= B. AI STUDY PLANNER =================
const ITEM = { type: 'OBJECT', properties: { taskId: { type: 'STRING' }, text: { type: 'STRING' } }, required: ['taskId', 'text'] };
const PLAN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING', description: 'Nhận xét tổng quan 2–3 câu' },
    focus: { type: 'ARRAY', items: ITEM, description: '2–3 nhiệm vụ cần tập trung trước và lý do' },
    risks: { type: 'ARRAY', items: ITEM, description: 'Các deadline có nguy cơ trễ và lý do' },
    allocation: { type: 'ARRAY', items: ITEM, description: 'Đề xuất phân bổ thời gian cho từng nhiệm vụ' },
    tips: { type: 'ARRAY', items: { type: 'STRING' }, description: '3–5 lời khuyên cải thiện lịch học' },
  },
  required: ['summary', 'focus', 'risks', 'allocation', 'tips'],
};

interface RawPlan {
  summary?: unknown;
  focus?: unknown;
  risks?: unknown;
  allocation?: unknown;
  tips?: unknown;
}

/** Giữ lại các mục tham chiếu task CÓ THẬT; đếm số mục bị loại. */
export function sanitizePlan(raw: RawPlan, validTaskIds: Set<string>): StudyPlan {
  let dropped = 0;
  const items = (v: unknown): PlanItem[] => {
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is PlanItem => {
      const ok = typeof x === 'object' && x !== null && typeof x.taskId === 'string' && typeof x.text === 'string' && validTaskIds.has(x.taskId);
      if (!ok) dropped++;
      return ok;
    });
  };
  return {
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    focus: items(raw.focus),
    risks: items(raw.risks),
    allocation: items(raw.allocation),
    tips: Array.isArray(raw.tips) ? raw.tips.filter((t): t is string => typeof t === 'string').slice(0, 6) : [],
    droppedItems: dropped,
  };
}

export async function planStudy(data: AppData, now: Date, mode: AiMode = getAiMode()): Promise<AiResult<StudyPlan>> {
  const ins = computeInsights(data, now);
  if (mode === 'demo') return { source: 'demo', data: buildDemoPlan(data, ins) };

  const { value: raw, model } = await generateJson<RawPlan>({
    systemInstruction: `${BASE_RULES}
Nhiệm vụ: lập kế hoạch học tập. "taskId" trong mọi mục PHẢI là "id" của một phần tử trong pendingTasks.`,
    turns: [{ role: 'user', text: `NGỮ CẢNH (JSON):\n${JSON.stringify(buildAiContext(data, ins, now))}\n\nHãy phân tích và lập kế hoạch học cho tôi.` }],
    responseSchema: PLAN_SCHEMA,
  });
  return { source: 'gemini', model, data: sanitizePlan(raw, new Set(ins.insights.map((i) => i.result.task.id))) };
}

// ================= C. AI STUDY ADVISOR (chat) =================
export async function askAdvisor(history: ChatTurn[], question: string, data: AppData, now: Date, mode: AiMode = getAiMode()): Promise<AiResult<string>> {
  const ins = computeInsights(data, now);
  if (mode === 'demo') return { source: 'demo', data: answerDemoQuestion(question, data, ins) };

  const { text, model } = await generateText({
    systemInstruction: `${BASE_RULES}
Nhiệm vụ: trả lời câu hỏi tư vấn học tập. Dùng gạch đầu dòng "- " khi liệt kê, **in đậm** tên nhiệm vụ. Tối đa khoảng 200 từ.
NGỮ CẢNH (JSON, cập nhật tại thời điểm hỏi):
${JSON.stringify(buildAiContext(data, ins, now))}`,
    // Giữ 10 lượt gần nhất để tiết kiệm token
    turns: [...history.slice(-10), { role: 'user', text: question }],
    temperature: 0.5,
  });
  return { source: 'gemini', model, data: text };
}
