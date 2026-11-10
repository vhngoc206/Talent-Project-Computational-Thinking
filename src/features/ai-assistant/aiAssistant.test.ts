import { describe, expect, it } from 'vitest';
import { createSeedData } from '../../services/seedData';
import { getAiMode } from '../../services/aiService';
import { analyzeTask, askAdvisor, planStudy, sanitizePlan, sanitizeTaskDraft } from './assistantApi';
import { answerDemoQuestion } from './demoAdvisor';
import { extractTitle, matchSubject, parseDeadline, parseDifficulty, parseDuration, parseImportance, parseTaskDemo } from './demoTaskParser';
import { computeInsights } from './studyInsights';

// Thứ tư 04/11/2026 08:00 giờ địa phương
const NOW = new Date(2026, 10, 4, 8, 0);
const data = createSeedData(NOW);

describe('Demo Task Analyzer (rule-based)', () => {
  it('phân tích đúng câu ví dụ trong đề bài', () => {
    const d = parseTaskDemo(
      'Tôi có bài tập cơ sở dữ liệu gồm 5 câu, hạn nộp thứ Sáu tuần này, độ khó trung bình. Tôi cần khoảng 3 tiếng để hoàn thành.',
      data.subjects,
      NOW,
    );
    expect(d.title).toBe('Bài tập cơ sở dữ liệu gồm 5 câu');
    expect(d.subjectId).toBe('sub-db');
    const dl = new Date(d.deadline!);
    expect([dl.getDate(), dl.getMonth(), dl.getHours(), dl.getMinutes()]).toEqual([6, 10, 23, 59]); // thứ sáu 06/11 23:59
    expect(d.difficulty).toBe('medium');
    expect(d.estimatedMinutes).toBe(180);
    expect(['low', 'medium', 'high']).toContain(d.importance);
  });

  it('nhận diện ngày mai + giờ cụ thể, "khó", số giờ', () => {
    const d = parseTaskDemo('Báo cáo đồ án lập trình web nộp ngày mai lúc 17h, khá khó, mất 4 tiếng', data.subjects, NOW);
    expect(d.subjectId).toBe('sub-web');
    const dl = new Date(d.deadline!);
    expect([dl.getDate(), dl.getHours(), dl.getMinutes()]).toEqual([5, 17, 0]);
    expect(d.difficulty).toBe('hard');
    expect(d.estimatedMinutes).toBe(240);
    expect(d.importance).toBe('high'); // có từ "đồ án"
  });

  it('"để" không bị hiểu nhầm là "dễ"', () => {
    expect(parseDifficulty('cần 2 tiếng để làm')).toBeNull();
    expect(parseDifficulty('bài này dễ')).toBe('easy');
  });

  it('"tôi" không bị hiểu là "tối" khi đổi giờ', () => {
    const r = parseDeadline('Tôi nộp ngày mai lúc 9h', NOW);
    expect(r.date!.getHours()).toBe(9);
    const r2 = parseDeadline('nộp tối mai lúc 9 giờ', NOW);
    expect(r2.date!.getHours()).toBe(21);
  });

  it('thứ trong tuần sau, ngày dd/mm, và không có deadline', () => {
    expect(parseDeadline('thứ hai tuần sau', NOW).date!.getDate()).toBe(9);
    expect(parseDeadline('hạn 20/11', NOW).date!.getDate()).toBe(20);
    expect(parseDeadline('làm khi rảnh', NOW).date).toBeNull();
  });

  it('thời lượng: giờ rưỡi, phút, kết hợp', () => {
    expect(parseDuration('mất 1 tiếng rưỡi')).toBe(90);
    expect(parseDuration('khoảng 45 phút')).toBe(45);
    expect(parseDuration('2 giờ 30 phút')).toBe(150);
    expect(parseDuration('không rõ')).toBeNull();
  });

  it('mức quan trọng ưu tiên phủ định', () => {
    expect(parseImportance('việc này không quan trọng lắm')).toBe('low');
    expect(parseImportance('rất quan trọng')).toBe('high');
  });

  it('chỉ khớp môn học có thật (tên, mã, viết tắt)', () => {
    expect(matchSubject('bài ERP chương 3', data.subjects)?.id).toBe('sub-erp');
    expect(matchSubject('ôn csdl', data.subjects)?.id).toBe('sub-db');
    expect(matchSubject('học tiếng Nhật', data.subjects)).toBeNull();
  });

  it('tách tên nhiệm vụ', () => {
    expect(extractTitle('Mình cần ôn tập quiz chương 3, hạn thứ hai')).toBe('Ôn tập quiz chương 3');
  });
});

describe('Kiểm tra kết quả Gemini (không chấp nhận dữ liệu bịa)', () => {
  it('bỏ môn học không tồn tại và chuẩn hóa giá trị', () => {
    const d = sanitizeTaskDraft(
      { title: 'X', subjectId: 'sub-khong-co', deadline: '2026-11-06T17:00', difficulty: 'impossible', importance: 'high', estimatedMinutes: 99999, notes: [] },
      data,
      'x',
    );
    expect(d.subjectId).toBeNull();
    expect(d.difficulty).toBe('medium');
    expect(d.estimatedMinutes).toBe(2400);
    expect(new Date(d.deadline!).getHours()).toBe(17);
    expect(d.notes.some((n) => n.includes('không có trong danh sách'))).toBe(true);
  });

  it('loại các mục kế hoạch tham chiếu task không tồn tại', () => {
    const plan = sanitizePlan(
      { summary: 'ok', focus: [{ taskId: 'task-db-sql', text: 'a' }, { taskId: 'task-ma', text: 'b' }], risks: [], allocation: 'sai kiểu', tips: ['t'] },
      new Set(['task-db-sql']),
    );
    expect(plan.focus).toHaveLength(1);
    expect(plan.droppedItems).toBe(1);
    expect(plan.allocation).toEqual([]);
  });
});

describe('Demo Mode khi không có API key', () => {
  it('không có GEMINI_API_KEY trong môi trường test => demo', () => {
    expect(getAiMode()).toBe('demo');
  });

  it('3 chức năng AI đều chạy và gắn nhãn source = demo', async () => {
    const a = await analyzeTask('bài tập SQL nộp ngày mai, 2 tiếng', data, NOW);
    expect(a.source).toBe('demo');
    expect(a.data.subjectId).toBe('sub-db');

    const p = await planStudy(data, NOW);
    expect(p.source).toBe('demo');
    const ids = new Set(data.tasks.map((t) => t.id));
    for (const it of [...p.data.focus, ...p.data.risks, ...p.data.allocation]) expect(ids.has(it.taskId)).toBe(true);
    // Dữ liệu mẫu có task quá hạn => phải nằm trong danh sách rủi ro
    expect(p.data.risks.some((r) => r.taskId === 'task-erp-report')).toBe(true);

    const c = await askAdvisor([], 'Nhiệm vụ nào đang có nguy cơ trễ?', data, NOW);
    expect(c.source).toBe('demo');
    expect(c.data).toContain('Báo cáo phân tích quy trình mua hàng');
  });

  it('Advisor demo trả lời theo từng dạng câu hỏi bằng dữ liệu thật', () => {
    const ins = computeInsights(data, NOW);
    expect(answerDemoQuestion('Tuần này tôi nên học môn nào trước?', data, ins)).toContain(ins.insights[0].result.task.title);
    expect(answerDemoQuestion('Tôi có thể hoàn thành tất cả deadline không?', data, ins)).toMatch(/thời gian rảnh/);
    expect(answerDemoQuestion('Tôi nên chia đồ án giỏ hàng thành bao nhiêu phiên?', data, ins)).toContain('giỏ hàng');
    expect(answerDemoQuestion('thời tiết hôm nay?', data, ins)).toContain('Demo Mode');
  });
});
