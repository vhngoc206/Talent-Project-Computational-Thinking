/**
 * DEMO MODE – Study Planner & Study Advisor bằng logic có sẵn (KHÔNG phải AI).
 * Mọi câu trả lời được tính từ StudyInsights (Priority Engine + Greedy Scheduler + thống kê),
 * nên chỉ nói về môn học / nhiệm vụ / deadline có thật trong dữ liệu.
 */
import { WEEKDAY_SHORT } from '../../constants';
import type { AppData, Task } from '../../types';
import { formatDeadline, formatMinutes } from '../../utils/date';
import { normalizeText } from '../../utils/text';
import type { StudyInsights, TaskInsight } from './studyInsights';
import type { StudyPlan } from './types';

const label = (i: TaskInsight) => `**${i.result.task.title}**${i.subject ? ` (${i.subject.code})` : ''}`;

function sessionWhen(i: TaskInsight): string {
  const s = i.firstSession;
  if (!s) return '';
  const d = new Date(`${s.date}T00:00:00`);
  return `${WEEKDAY_SHORT[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} lúc ${s.startTime}`;
}

// =============== AI Study Planner (demo) ===============
export function buildDemoPlan(data: AppData, ins: StudyInsights): StudyPlan {
  const { insights, atRisk, simulation, overview } = ins;
  const { requiredMinutes, capacityMinutes, horizonDays } = simulation.stats;

  const summary =
    insights.length === 0
      ? 'Bạn không còn nhiệm vụ nào chưa hoàn thành.'
      : `Bạn còn ${insights.length} nhiệm vụ chưa xong, cần khoảng ${formatMinutes(requiredMinutes)} học nữa; ` +
        `thời gian rảnh trong ${horizonDays} ngày tới là ${formatMinutes(capacityMinutes)}. ` +
        (atRisk.length === 0
          ? 'Với lịch rảnh hiện tại, tất cả deadline đều kịp.'
          : `Có ${atRisk.length} nhiệm vụ đang có nguy cơ trễ hạn.`);

  const focus = insights.slice(0, 3).map((i) => ({
    taskId: i.result.task.id,
    text: `Điểm ưu tiên ${i.result.score.toFixed(2)} – ${i.result.reasons.slice(0, 2).join('; ').toLowerCase()}. Còn ${formatMinutes(i.remainingMinutes)} phải học.`,
  }));

  const risks = atRisk.map((i) => ({ taskId: i.result.task.id, text: i.riskReason }));

  const allocation = insights
    .filter((i) => i.remainingMinutes > 0)
    .slice(0, 6)
    .map((i) => ({
      taskId: i.result.task.id,
      text:
        i.risk === 'overdue'
          ? `Đã quá hạn – làm ngay trong hôm nay (${i.sessionsNeeded} phiên × ${data.availability.sessionMinutes} phút).`
          : i.scheduledMinutes > 0
            ? `${i.sessionsNeeded} phiên × ${data.availability.sessionMinutes} phút, bắt đầu ${sessionWhen(i)}` +
              (i.missingMinutes > 0 ? `; vẫn thiếu ${formatMinutes(i.missingMinutes)}.` : '.')
            : `Không còn khung rảnh trước deadline (${formatDeadline(i.result.task.deadline)}) – cần thêm giờ rảnh.`,
    }));

  const tips: string[] = [];
  if (insights.some((i) => i.risk === 'overdue')) tips.push('Xử lý các nhiệm vụ quá hạn trước tiên, hoặc trao đổi với giảng viên để xin gia hạn.');
  if (requiredMinutes > capacityMinutes)
    tips.push(`Thời gian rảnh đang thiếu ${formatMinutes(requiredMinutes - capacityMinutes)} – thêm khung giờ (ví dụ buổi sáng cuối tuần) trong trang Lịch học.`);
  if (data.availability.breakMinutes === 0) tips.push('Bạn chưa đặt thời gian nghỉ giữa các phiên – nghỉ 5–10 phút giúp tập trung lâu hơn.');
  if (data.availability.sessionMinutes === 90) tips.push('Phiên 90 phút khá dài; nếu thấy mệt, chuyển sang 45–60 phút.');
  const hard = insights.filter((i) => i.result.task.difficulty === 'hard');
  if (hard.length > 0) tips.push(`Chia nhỏ nhiệm vụ khó (${hard.map((i) => i.result.task.title).slice(0, 2).join(', ')}) và học vào lúc tỉnh táo nhất.`);
  if (ins.last7DaysMinutes < 300) tips.push(`7 ngày qua bạn mới học ${formatMinutes(ins.last7DaysMinutes)} – thử duy trì ít nhất 1 phiên Pomodoro mỗi ngày.`);
  if (overview.completionRate < 50 && overview.totalTasks > 0) tips.push('Hoàn thành dứt điểm từng nhiệm vụ trước khi mở việc mới để tăng tỷ lệ hoàn thành.');
  tips.push('Dùng Pomodoro và đánh dấu phiên trong Lịch học để giờ học thực tế được ghi vào tiến độ.');

  return { summary, focus, risks, allocation, tips: tips.slice(0, 5), droppedItems: 0 };
}

// =============== AI Study Advisor (demo chat) ===============
export const SAMPLE_QUESTIONS = [
  'Tuần này tôi nên học môn nào trước?',
  'Tôi có thể hoàn thành tất cả deadline không?',
  'Nhiệm vụ nào đang có nguy cơ trễ?',
  'Tôi nên chia bài tập này thành bao nhiêu phiên?',
  'Làm sao để cải thiện tiến độ học tập?',
];

/** Tìm nhiệm vụ được nhắc tới trong câu hỏi (so khớp từ trong tên) */
function findMentionedTask(question: string, tasks: Task[]): Task | undefined {
  const q = ` ${normalizeText(question).replace(/[^a-z0-9]+/g, ' ')} `;
  let best: { task: Task; score: number } | undefined;
  for (const t of tasks) {
    const words = normalizeText(t.title)
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((w) => w.length >= 3 && !['bai', 'tap', 'cho', 'cua', 'va'].includes(w));
    const hit = words.filter((w) => q.includes(` ${w} `)).length;
    const score = words.length ? hit / words.length : 0;
    if (hit >= 1 && score > (best?.score ?? 0)) best = { task: t, score };
  }
  return best?.task;
}

export function answerDemoQuestion(question: string, data: AppData, ins: StudyInsights): string {
  const q = normalizeText(question);
  const { insights, atRisk, simulation } = ins;
  const { requiredMinutes, capacityMinutes, horizonDays } = simulation.stats;

  if (insights.length === 0) return 'Hiện bạn không còn nhiệm vụ nào chưa hoàn thành. Hãy thêm nhiệm vụ mới để mình phân tích nhé!';

  // 1) Chia bao nhiêu phiên
  if (/bao nhieu phien|chia .*phien|chia nho|may phien/.test(q)) {
    const pending = insights.map((i) => i.result.task);
    const task = findMentionedTask(question, pending);
    const target = insights.find((i) => i.result.task.id === task?.id) ?? insights[0];
    const len = data.availability.sessionMinutes;
    const brk = data.availability.breakMinutes;
    return [
      `${task ? '' : 'Mình không thấy tên nhiệm vụ cụ thể trong câu hỏi, nên lấy nhiệm vụ ưu tiên nhất. '}Với ${label(target)}:`,
      `- Còn **${formatMinutes(target.remainingMinutes)}** phải học (ước tính ${formatMinutes(target.result.task.estimatedMinutes)}, đã học ${formatMinutes(target.result.task.actualMinutes)}).`,
      `- Với phiên ${len} phút, nên chia thành **${target.sessionsNeeded} phiên**${brk ? `, nghỉ ${brk} phút giữa các phiên` : ''}.`,
      target.firstSession ? `- Theo lịch mô phỏng, phiên đầu tiên có thể bắt đầu ${sessionWhen(target)}.` : '- Hiện không còn khung rảnh trước deadline để xếp phiên nào.',
    ].join('\n');
  }

  // 2) Nguy cơ trễ
  if (/nguy co|\btre\b|qua han|khong kip|rui ro/.test(q) && !/hoan thanh (het|tat ca)/.test(q)) {
    if (atRisk.length === 0) return 'Tin vui: với thời gian rảnh hiện tại, **không có nhiệm vụ nào có nguy cơ trễ hạn**. Cứ giữ nhịp học như lịch đã xếp nhé.';
    return [`Có **${atRisk.length} nhiệm vụ** cần chú ý:`, ...atRisk.slice(0, 5).map((i) => `- ${label(i)} – ${i.riskReason} (deadline ${formatDeadline(i.result.task.deadline)})`)].join('\n');
  }

  // 3) Có hoàn thành hết không
  if (/hoan thanh (het|tat ca)|kip (het|tat ca)|du thoi gian|kip khong|co kip/.test(q)) {
    const ok = requiredMinutes <= capacityMinutes && atRisk.every((i) => i.risk === 'medium');
    const lines = [
      `Bạn cần khoảng **${formatMinutes(requiredMinutes)}** để hoàn thành các nhiệm vụ còn lại, trong khi thời gian rảnh ${horizonDays} ngày tới là **${formatMinutes(capacityMinutes)}**.`,
    ];
    if (ok) lines.push('- Nếu học đúng lịch, **bạn có thể hoàn thành tất cả deadline**.');
    else {
      lines.push('- **Chưa thể hoàn thành tất cả** với lịch rảnh hiện tại:');
      for (const i of atRisk.filter((x) => x.risk !== 'medium').slice(0, 4)) lines.push(`- ${label(i)}: ${i.riskReason}`);
      lines.push('- Gợi ý: thêm khung giờ rảnh, giảm thời gian ước tính nếu hợp lý, hoặc ưu tiên làm ngay các việc quá hạn.');
    }
    return lines.join('\n');
  }

  // 4) Nên học môn nào trước
  if (/mon nao|hoc gi|lam gi|truoc|uu tien|bat dau/.test(q)) {
    return [
      'Theo Smart Priority Engine, thứ tự nên học là:',
      ...insights.slice(0, 3).map((i, idx) => `${idx + 1}. ${label(i)} – điểm ${i.result.score.toFixed(2)}: ${i.result.reasons.slice(0, 2).join('; ').toLowerCase()}.`),
      insights[0].firstSession ? `\nBắt đầu với nhiệm vụ số 1 vào ${sessionWhen(insights[0])}.` : '',
    ]
      .join('\n')
      .trim();
  }

  // 5) Cải thiện tiến độ
  if (/cai thien|tien do|hieu qua|meo|loi khuyen|tap trung|nang suat/.test(q)) {
    const plan = buildDemoPlan(data, ins);
    return [
      `Tỷ lệ hoàn thành hiện tại là **${ins.overview.completionRate}%**, 7 ngày qua bạn học **${formatMinutes(ins.last7DaysMinutes)}**.`,
      ...plan.tips.map((t) => `- ${t}`),
    ].join('\n');
  }

  return [
    'Ở Demo Mode mình chỉ trả lời được một số dạng câu hỏi bằng logic có sẵn (chưa có AI thật). Bạn thử hỏi:',
    ...SAMPLE_QUESTIONS.map((s) => `- ${s}`),
  ].join('\n');
}
