/**
 * DEMO MODE – AI Task Analyzer dự phòng bằng luật (rule-based), KHÔNG phải AI.
 * Dùng khi chưa có GEMINI_API_KEY. Nhận câu tiếng Việt tự nhiên, trích:
 * tên nhiệm vụ, môn học (chỉ trong các môn có thật), deadline, độ khó, thời gian, mức quan trọng.
 *
 * Hàm thuần, nhận `now` làm tham số => test được.
 */
import { DIFFICULTY_LABEL, IMPORTANCE_LABEL, WEEKDAY_LONG } from '../../constants';
import type { Difficulty, Importance, Subject } from '../../types';
import { addDays, formatDeadline, formatMinutes, startOfDay } from '../../utils/date';
import { normalizeText } from '../../utils/text';
import type { TaskDraft } from './types';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Có chứa cụm từ đứng riêng (không dính chữ khác)? Làm trên chữ CÓ dấu để phân biệt "dễ" và "để". */
function hasPhrase(text: string, phrase: string): boolean {
  return new RegExp(`(^|[^\\p{L}])${escapeRe(phrase)}($|[^\\p{L}])`, 'u').test(text);
}

// ---------------- Môn học ----------------
const STOP_WORDS = new Set(['he', 'thong', 'va', 'cua', 'cho', 'cac', 'mon', 'nguon', 'luc']);

/** Tìm môn học khớp nhất trong danh sách môn CÓ THẬT. */
export function matchSubject(text: string, subjects: Subject[]): Subject | null {
  const norm = ` ${normalizeText(text).replace(/[^a-z0-9]+/g, ' ')} `;
  const hasWord = (w: string) => w.length > 0 && norm.includes(` ${w} `);
  let best: { subject: Subject; score: number } | null = null;

  // Từ khóa trong MÔ TẢ chỉ thuộc riêng một môn (vd "sql" → Cơ sở dữ liệu) – tín hiệu yếu
  const descWords = subjects.map(
    (s) => new Set(normalizeText(s.description).replace(/[^a-z0-9]+/g, ' ').split(' ').filter((w) => w.length >= 3 && !STOP_WORDS.has(w))),
  );
  const uniqueDescWords = descWords.map((set, i) => [...set].filter((w) => descWords.every((other, j) => j === i || !other.has(w))));

  for (const [idx, s] of subjects.entries()) {
    const name = normalizeText(s.name).replace(/[^a-z0-9]+/g, ' ').trim();
    const code = normalizeText(s.code).replace(/[^a-z0-9]+/g, '');
    const codeLetters = code.replace(/\d+/g, '');
    const words = name.split(' ').filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
    const acronym = name
      .split(' ')
      .map((w) => w[0])
      .join('');

    let score = 0;
    if (norm.includes(` ${name} `)) score = 3;
    else if (hasWord(code)) score = 3;
    else if (acronym.length >= 2 && hasWord(acronym)) score = 2;
    else if (codeLetters.length >= 2 && hasWord(codeLetters)) score = 2;
    else if (words.length > 0) {
      const matched = words.filter(hasWord).length;
      score = matched === 0 ? 0 : (matched / words.length) * 1.5;
    }
    if (score === 0 && uniqueDescWords[idx].some(hasWord)) score = 0.5;
    if (score > (best?.score ?? 0.4)) best = { subject: s, score };
  }
  return best?.subject ?? null;
}

// ---------------- Deadline ----------------
const WEEKDAYS: Array<[RegExp, number]> = [
  [/\b(?:thu|t)\s*(?:hai|2)\b/, 1],
  [/\b(?:thu|t)\s*(?:ba|3)\b/, 2],
  [/\b(?:thu|t)\s*(?:tu|4)\b/, 3],
  [/\b(?:thu|t)\s*(?:nam|5)\b/, 4],
  [/\b(?:thu|t)\s*(?:sau|6)\b/, 5],
  [/\b(?:thu|t)\s*(?:bay|7)\b/, 6],
  [/\b(?:chu nhat|cn)\b/, 0],
];

interface DeadlineParse {
  date: Date | null;
  note: string;
  /** Phần văn bản đã dùng để nhận diện giờ (bỏ đi trước khi tìm thời lượng) */
  consumed: string[];
}

export function parseDeadline(raw: string, now: Date): DeadlineParse {
  const t = normalizeText(raw);
  const today = startOfDay(now);
  const mondayIdx = (today.getDay() + 6) % 7; // 0 = thứ hai
  const consumed: string[] = [];
  let day: Date | null = null;
  let how = '';

  // 1) Ngày cụ thể dd/mm(/yyyy)
  const dm = t.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (dm) {
    const d = Number(dm[1]);
    const m = Number(dm[2]);
    let y = dm[3] ? Number(dm[3]) : today.getFullYear();
    if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      day = new Date(y, m - 1, d);
      if (!dm[3] && day < today) day = new Date(y + 1, m - 1, d);
      how = `ngày ${dm[1]}/${dm[2]}`;
      consumed.push(dm[0]);
    }
  }

  // 2) Thứ trong tuần (+ tuần này / tuần sau)
  if (!day) {
    for (const [re, weekday] of WEEKDAYS) {
      if (!re.test(t)) continue;
      const targetIdx = (weekday + 6) % 7;
      const nextWeek = /\btuan (sau|toi)\b/.test(t);
      const thisWeek = /\btuan nay\b/.test(t);
      let diff = targetIdx - mondayIdx;
      if (nextWeek) diff += 7;
      else if (diff < 0) diff += 7; // ngày đó tuần này đã qua => tuần sau
      day = addDays(today, diff);
      how = `${WEEKDAY_LONG[weekday]} ${nextWeek ? 'tuần sau' : thisWeek && targetIdx >= mondayIdx ? 'tuần này' : 'sắp tới'}`;
      break;
    }
  }

  // 3) Ngày tương đối
  if (!day) {
    const nDays = t.match(/\b(\d{1,2})\s*ngay\s*(?:nua|toi)\b/);
    if (/\b(hom nay|chieu nay|sang nay)\b/.test(t) || hasPhrase(raw.toLowerCase(), 'tối nay')) [day, how] = [today, 'hôm nay'];
    else if (/\b(ngay kia|ngay mot)\b/.test(t)) [day, how] = [addDays(today, 2), 'ngày kia'];
    else if (/\b(ngay mai|toi mai|sang mai|chieu mai)\b/.test(t)) [day, how] = [addDays(today, 1), 'ngày mai'];
    else if (nDays) [day, how] = [addDays(today, Number(nDays[1])), `${nDays[1]} ngày nữa`];
    else if (/\bcuoi tuan\b/.test(t)) [day, how] = [addDays(today, 6 - mondayIdx), 'cuối tuần (Chủ nhật)'];
    else if (/\btuan (sau|toi)\b/.test(t)) [day, how] = [addDays(today, 7), 'tuần sau (7 ngày nữa)'];
  }

  if (!day) return { date: null, note: 'Không nhận diện được deadline – hãy chọn trong form.', consumed };

  // Giờ trong ngày
  let hour = 23;
  let minute = 59;
  let timeHow = 'mặc định 23:59';
  // Kiểm tra "chiều/tối" trên chữ có dấu: bỏ dấu thì "tôi" (ngôi thứ nhất) trùng với "tối"
  const lowerRaw = raw.toLowerCase();
  const afternoon = hasPhrase(lowerRaw, 'chiều') || hasPhrase(lowerRaw, 'tối');
  const timeMatch =
    t.match(/\b(?:luc|truoc|den)\s*(\d{1,2})(?:\s*(?:h|gio|:)\s*(\d{2})?)?\b/) ?? t.match(/\b(\d{1,2})(?::|h)(\d{2})\b/);
  if (timeMatch && Number(timeMatch[1]) <= 23) {
    hour = Number(timeMatch[1]);
    minute = timeMatch[2] ? Number(timeMatch[2]) : 0;
    if (afternoon && hour < 12 && hour >= 1) hour += 12; // "5 giờ chiều" => 17h
    timeHow = `lúc ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    consumed.push(timeMatch[0]);
  } else if (hasPhrase(lowerRaw, 'sáng')) [hour, minute, timeHow] = [8, 0, 'buổi sáng → 08:00'];
  else if (hasPhrase(lowerRaw, 'trưa')) [hour, minute, timeHow] = [12, 0, 'buổi trưa → 12:00'];
  else if (hasPhrase(lowerRaw, 'chiều')) [hour, minute, timeHow] = [17, 0, 'buổi chiều → 17:00'];

  const date = new Date(day);
  date.setHours(hour, minute, 0, 0);
  const passed = date.getTime() < now.getTime();
  return {
    date,
    note: `Deadline: ${how}, ${timeHow} → ${formatDeadline(date.toISOString())}${passed ? ' (đã qua!)' : ''}.`,
    consumed,
  };
}

// ---------------- Thời lượng ----------------
export function parseDuration(raw: string, consumed: string[] = []): number | null {
  let t = normalizeText(raw);
  for (const c of consumed) t = t.replace(c, ' ');
  let minutes = 0;
  const hours = t.match(/(\d+(?:[.,]\d+)?)\s*(?:tieng|gio|h)\b(\s*ruoi)?/);
  if (hours) minutes += Math.round(parseFloat(hours[1].replace(',', '.')) * 60) + (hours[2] ? 30 : 0);
  const mins = t.match(/(\d+)\s*(?:phut|p)\b/);
  if (mins) minutes += Number(mins[1]);
  return minutes > 0 ? minutes : null;
}

// ---------------- Độ khó & mức quan trọng ----------------
export function parseDifficulty(raw: string): Difficulty | null {
  const t = raw.toLowerCase();
  if (/độ khó\s*(trung bình|vừa)/u.test(t)) return 'medium';
  if (/độ khó\s*(cao|lớn)/u.test(t)) return 'hard';
  if (/độ khó\s*(thấp|nhỏ)/u.test(t)) return 'easy';
  if (['rất khó', 'khó', 'phức tạp', 'nặng'].some((p) => hasPhrase(t, p))) return 'hard';
  if (['dễ', 'đơn giản', 'nhẹ nhàng'].some((p) => hasPhrase(t, p))) return 'easy';
  if (['trung bình', 'vừa phải', 'bình thường'].some((p) => hasPhrase(t, p))) return 'medium';
  return null;
}

export function parseImportance(raw: string): Importance | null {
  const t = raw.toLowerCase();
  if (['không quan trọng', 'ít quan trọng', 'không gấp', 'không bắt buộc'].some((p) => hasPhrase(t, p))) return 'low';
  if (['rất quan trọng', 'quan trọng', 'gấp', 'khẩn', 'giữa kỳ', 'cuối kỳ', 'đồ án', 'bài thi', 'thi cuối'].some((p) => hasPhrase(t, p))) return 'high';
  return null;
}

// ---------------- Tên nhiệm vụ ----------------
const KINDS = ['bài tập lớn', 'bài tập', 'bài kiểm tra', 'đồ án', 'báo cáo', 'tiểu luận', 'thuyết trình', 'ôn tập', 'ôn thi', 'quiz', 'bài lab', 'bài thi', 'slide'];
const STOP_AT = [',', '.', ';', '\n', ' hạn ', ' hạn nộp', ' deadline', ' nộp ', ' nộp vào', ' trước ', ' độ khó', ' cần ', ' mất ', ' khoảng ', ' vào thứ', ' thứ ', ' ngày mai', ' tuần này', ' tuần sau'];

export function extractTitle(raw: string): string {
  const text = raw.replace(/\s+/g, ' ').trim();
  const lower = text.toLowerCase();
  let start = -1;
  for (const k of KINDS) {
    const m = new RegExp(`(^|[^\\p{L}])(${escapeRe(k)})($|[^\\p{L}])`, 'u').exec(lower);
    if (m && (start === -1 || m.index + m[1].length < start)) start = m.index + m[1].length;
  }
  let title = start >= 0 ? text.slice(start) : text.replace(/^(tôi|mình|em|tớ|tui)\s+(có|cần|phải|sắp có)\s+(một\s+|1\s+)?/iu, '');
  const lowerTitle = ` ${title.toLowerCase()}`;
  let end = title.length;
  for (const s of STOP_AT) {
    const idx = lowerTitle.indexOf(s, 1);
    if (idx > 0 && idx - 1 < end) end = idx - 1;
  }
  title = title.slice(0, end).trim().slice(0, 100);
  return title ? title[0].toUpperCase() + title.slice(1) : 'Nhiệm vụ mới';
}

/** Hàm chính của Demo Task Analyzer */
export function parseTaskDemo(text: string, subjects: Subject[], now: Date): TaskDraft {
  const notes: string[] = [];
  const subject = matchSubject(text, subjects);
  notes.push(subject ? `Môn học: nhận ra "${subject.name}" (${subject.code}).` : 'Không nhận ra môn học nào trong danh sách – hãy chọn trong form.');

  const deadline = parseDeadline(text, now);
  notes.push(deadline.note);

  let difficulty = parseDifficulty(text);
  if (difficulty) notes.push(`Độ khó: "${DIFFICULTY_LABEL[difficulty]}" theo mô tả.`);
  else {
    difficulty = subject?.difficulty ?? 'medium';
    notes.push(`Độ khó: không nêu rõ – lấy theo độ khó của môn (${DIFFICULTY_LABEL[difficulty]}).`);
  }

  let minutes = parseDuration(text, deadline.consumed);
  if (minutes) notes.push(`Thời gian dự kiến: ${formatMinutes(minutes)} theo mô tả.`);
  else {
    minutes = { easy: 60, medium: 120, hard: 180 }[difficulty];
    notes.push(`Thời gian dự kiến: không nêu rõ – ước tính ${formatMinutes(minutes)} theo độ khó.`);
  }
  minutes = Math.min(2400, Math.max(5, Math.round(minutes / 5) * 5));

  let importance = parseImportance(text);
  if (importance) notes.push(`Mức quan trọng: "${IMPORTANCE_LABEL[importance]}" theo từ khóa trong câu.`);
  else {
    const daysLeft = deadline.date ? (deadline.date.getTime() - now.getTime()) / 86_400_000 : 7;
    importance = daysLeft < 3 || difficulty === 'hard' ? 'high' : daysLeft > 7 && difficulty === 'easy' ? 'low' : 'medium';
    notes.push(`Gợi ý mức quan trọng "${IMPORTANCE_LABEL[importance]}" dựa trên deadline và độ khó.`);
  }

  return {
    title: extractTitle(text),
    subjectId: subject?.id ?? null,
    deadline: deadline.date ? deadline.date.toISOString() : null,
    difficulty,
    importance,
    estimatedMinutes: minutes,
    description: text.trim().slice(0, 500),
    notes,
  };
}
