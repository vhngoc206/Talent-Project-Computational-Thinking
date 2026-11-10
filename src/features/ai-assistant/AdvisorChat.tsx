import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Eraser, MessagesSquare, SendHorizontal } from 'lucide-react';
import { Button, IconButton } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { getAiMode, type AiMode, type ChatTurn } from '../../services/aiService';
import { useAppState } from '../../state/AppStateContext';
import { cn } from '../../utils/cn';
import { askAdvisor } from './assistantApi';
import { ErrorBox, LoadingBox, SourceBadge } from './AiStatus';
import { SAMPLE_QUESTIONS } from './demoAdvisor';
import { SimpleMarkdown } from './SimpleMarkdown';

interface Message {
  id: number;
  role: 'user' | 'model';
  text: string;
  source?: AiMode;
  model?: string;
}

type Pending = { status: 'idle' } | { status: 'loading' } | { status: 'error'; error: unknown; question: string };

/** C. AI STUDY ADVISOR – chatbot hỏi đáp, ngữ cảnh là dữ liệu thật của ứng dụng tại thời điểm hỏi. */
export function AdvisorChat() {
  const { data } = useAppState();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<Pending>({ status: 'idle' });
  const listRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pending]);

  /** Gửi câu hỏi. `alreadyShown` = câu hỏi đã nằm trong danh sách (khi Thử lại) */
  async function ask(question: string, mode: AiMode = getAiMode(), alreadyShown = false) {
    const q = question.trim();
    if (!q || pending.status === 'loading') return;
    // Lịch sử gửi cho Gemini: các lượt trước câu hỏi này
    const prior = alreadyShown ? messages.slice(0, -1) : messages;
    const history: ChatTurn[] = prior.map((m) => ({ role: m.role, text: m.text }));
    if (!alreadyShown) setMessages((list) => [...list, { id: nextId.current++, role: 'user', text: q }]);
    setInput('');
    setPending({ status: 'loading' });
    try {
      const res = await askAdvisor(history, q, data, new Date(), mode);
      setMessages((list) => [...list, { id: nextId.current++, role: 'model', text: res.data, source: res.source, model: res.model }]);
      setPending({ status: 'idle' });
    } catch (error) {
      setPending({ status: 'error', error, question: q });
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        icon={<MessagesSquare className="h-4 w-4" aria-hidden />}
        title="AI Study Advisor"
        subtitle="Hỏi bất cứ điều gì về kế hoạch học của bạn"
        action={
          messages.length > 0 ? (
            <IconButton label="Xóa cuộc trò chuyện" onClick={() => { setMessages([]); setPending({ status: 'idle' }); }}>
              <Eraser className="h-4 w-4" />
            </IconButton>
          ) : undefined
        }
      />

      <div ref={listRef} className="min-h-[280px] flex-1 space-y-3 overflow-y-auto rounded-2xl bg-cream/60 p-3 xl:max-h-[520px]" aria-live="polite">
        {messages.length === 0 && (
          <div className="p-2 text-sm text-ink-soft">
            <p className="mb-2 font-bold text-ink">Xin chào! Bạn có thể hỏi:</p>
            <div className="flex flex-col items-start gap-1.5">
              {SAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void ask(q)}
                  className="rounded-2xl bg-white px-3 py-1.5 text-left text-xs font-bold text-ink-soft shadow-sm hover:bg-brand-tint hover:text-ink"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'anim-fade-up max-w-[88%] rounded-2xl px-3.5 py-2.5',
                m.role === 'user' ? 'rounded-br-md bg-brand text-ink' : 'rounded-bl-md bg-white text-ink-soft shadow-sm',
              )}
            >
              {m.role === 'model' && m.source && (
                <div className="mb-1.5">
                  <SourceBadge source={m.source} model={m.model} />
                </div>
              )}
              {m.role === 'user' ? <p className="whitespace-pre-wrap text-sm font-semibold">{m.text}</p> : <SimpleMarkdown text={m.text} />}
            </div>
          </div>
        ))}

        {pending.status === 'loading' && <LoadingBox text={getAiMode() === 'gemini' ? 'AI đang trả lời…' : 'Đang tìm câu trả lời…'} />}
        {pending.status === 'error' && (
          <ErrorBox
            error={pending.error}
            onRetry={() => void ask(pending.question, getAiMode(), true)}
            onUseDemo={() => void ask(pending.question, 'demo', true)}
          />
        )}
      </div>

      <form onSubmit={onSubmit} className="mt-3 flex gap-2">
        <label htmlFor="advisor-input" className="sr-only">
          Câu hỏi
        </label>
        <input
          id="advisor-input"
          className="input-base"
          placeholder="Ví dụ: Nhiệm vụ nào đang có nguy cơ trễ?"
          value={input}
          maxLength={500}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button type="submit" variant="primary" icon={<SendHorizontal className="h-4 w-4" />} disabled={!input.trim() || pending.status === 'loading'} aria-label="Gửi">
          <span className="hidden sm:inline">Gửi</span>
        </Button>
      </form>
    </Card>
  );
}
