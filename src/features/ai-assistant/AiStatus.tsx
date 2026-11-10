import { AlertTriangle, FlaskConical, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { getAiMode, type AiMode } from '../../services/aiService';
import { describeAiError } from '../../services/aiService';

/** Nhãn nguồn của mỗi câu trả lời – chế độ gợi ý cơ bản luôn được ghi rõ là không dùng AI. */
export function SourceBadge({ source }: { source: AiMode; model?: string }) {
  return source === 'gemini' ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky px-2 py-0.5 text-[11px] font-extrabold text-sky-deep">
      <Sparkles className="h-3 w-3" aria-hidden /> Trợ lý AI
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-butter px-2 py-0.5 text-[11px] font-extrabold text-warn-fg">
      <FlaskConical className="h-3 w-3" aria-hidden /> Gợi ý cơ bản · không dùng AI
    </span>
  );
}

/** Chỉ hiện khi AI tạm thời không dùng được. */
export function AiModeBanner() {
  if (getAiMode() === 'gemini') return null;
  return (
    <section className="flex items-center gap-3 rounded-2xl bg-butter/70 p-4" aria-label="Trạng thái trợ lý">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-warn-fg">
        <FlaskConical className="h-4 w-4" aria-hidden />
      </span>
      <p className="text-sm text-ink-soft">
        <strong className="text-ink">Trợ lý AI đang tạm nghỉ.</strong> Các gợi ý bên dưới được tính từ dữ liệu của bạn bằng quy tắc có sẵn.
      </p>
    </section>
  );
}

export function LoadingBox({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-cream/80 px-4 py-3 text-sm font-semibold text-ink-soft" role="status">
      <Loader2 className="h-4 w-4 animate-spin text-brand-deep" aria-hidden />
      {text}
    </div>
  );
}

/** Lỗi khi gọi Gemini: Thử lại, hoặc (chủ động, có ghi rõ) dùng Demo Mode cho lần này. */
export function ErrorBox({ error, onRetry, onUseDemo }: { error: unknown; onRetry: () => void; onUseDemo?: () => void }) {
  return (
    <div className="rounded-2xl bg-danger-bg px-4 py-3 text-sm text-danger-fg" role="alert">
      <p className="flex items-start gap-2 font-semibold">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {describeAiError(error)}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={onRetry}>
          Thử lại
        </Button>
        {onUseDemo && (
          <Button size="sm" variant="ghost" onClick={onUseDemo}>
            Dùng gợi ý cơ bản
          </Button>
        )}
      </div>
    </div>
  );
}
