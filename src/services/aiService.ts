/**
 * AI SERVICE – lớp duy nhất nói chuyện với Gemini API.
 *
 * - Trình duyệt KHÔNG giữ API key: mọi yêu cầu đi qua /api/gemini (server/handlers.ts),
 *   server đọc GEMINI_API_KEY từ biến môi trường (.env khi dev, Environment Variables khi deploy).
 * - Lúc khởi động, loadAiConfig() hỏi /api/config xem server đã có key chưa.
 *   Chưa có key (hoặc không có server, ví dụ chạy test) => getAiMode() = 'demo'; giao diện ghi rõ "Demo Mode".
 * - Mọi lỗi (key sai, hết quota, mạng, timeout, model không tồn tại…) được đổi thành AiError
 *   với thông báo tiếng Việt để giao diện hiển thị + nút Thử lại.
 */

export type AiMode = 'gemini' | 'demo';

/** Model nhẹ trả lời nhanh và ít bị quá tải nhất (kiểm tra 06/11/2026: ~2 giây khi các model khác báo 503) */
export const DEFAULT_MODEL = 'gemini-flash-lite-latest';
/** Model dự phòng, thử lần lượt khi model trước quá tải / hết lượt / không trả lời */
export const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-3.5-flash-lite', 'gemini-3.5-flash'];
const PROXY_URL = '/api/gemini';
/** Thời gian chờ mỗi lần gọi một model */
const ATTEMPT_TIMEOUT_MS = 20_000;
/** Tổng thời gian tối đa cho một câu hỏi (kể cả thử lại) */
const TOTAL_BUDGET_MS = 75_000;
/** Lượt thử: lượt 1 thử mọi model; lượt 2 đợi một chút rồi thử lại (quá tải thường chỉ kéo dài vài giây) */
const ROUNDS = 2;
const RETRY_DELAY_MS = 2_500;
/** Những lỗi mà đổi model / thử lại có thể giúp được */
const RETRYABLE: AiErrorKind[] = ['overloaded', 'timeout', 'server', 'quota', 'model'];

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => (clearTimeout(id), resolve()), { once: true });
  });

/** Cấu hình tính năng do server báo về (không chứa key) */
export interface ServerFeatures {
  gemini: boolean;
  model: string;
  youtube: boolean;
}

let features: ServerFeatures = { gemini: false, model: DEFAULT_MODEL, youtube: false };

/** Gọi một lần trước khi render app. Lỗi/không có server => giữ Demo Mode. */
export async function loadAiConfig(timeoutMs = 4000): Promise<ServerFeatures> {
  try {
    const res = await fetch('/api/config', { signal: AbortSignal.timeout(timeoutMs) });
    if (res.ok) {
      const json = (await res.json()) as Partial<ServerFeatures>;
      features = {
        gemini: json.gemini === true,
        model: typeof json.model === 'string' && json.model ? json.model : DEFAULT_MODEL,
        youtube: json.youtube === true,
      };
    }
  } catch {
    /* không có server (ví dụ mở file tĩnh) => Demo Mode */
  }
  return features;
}

export function getServerFeatures(): ServerFeatures {
  return features;
}

export function getModelName(): string {
  return features.model;
}

/** 'gemini' khi server đã cấu hình key, ngược lại 'demo' */
export function getAiMode(): AiMode {
  return features.gemini ? 'gemini' : 'demo';
}

export type AiErrorKind = 'no_key' | 'overloaded' | 'auth' | 'quota' | 'model' | 'network' | 'timeout' | 'blocked' | 'bad_response' | 'server';

export class AiError extends Error {
  constructor(
    public kind: AiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

/** Lượt hội thoại gửi cho Gemini */
export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

interface GenerateOptions {
  systemInstruction: string;
  turns: ChatTurn[];
  /** Có giá trị => yêu cầu Gemini trả JSON theo schema này (OpenAPI subset) */
  responseSchema?: Record<string, unknown>;
  temperature?: number;
  signal?: AbortSignal;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
}

function errorFromStatus(status: number, apiMessage: string, _model: string): AiError {
  if (status === 501) return new AiError('no_key', 'Trợ lý AI chưa sẵn sàng. Hãy dùng gợi ý cơ bản.');
  if (status === 400 && /api key/i.test(apiMessage)) return new AiError('auth', 'Trợ lý AI tạm thời không khả dụng. Thử lại sau nhé.');
  if (status === 401 || status === 403) return new AiError('auth', 'Trợ lý AI tạm thời không khả dụng. Thử lại sau nhé.');
  if (status === 404) return new AiError('model', 'Trợ lý AI tạm thời không khả dụng. Thử lại sau nhé.');
  if (status === 503) return new AiError('overloaded', 'AI đang quá tải. Thử lại sau ít phút nhé.');
  if (status === 429) return new AiError('quota', 'Bạn hỏi hơi nhanh rồi – đợi một lát rồi thử lại nhé.');
  if (status >= 500) return new AiError('server', 'AI đang gặp sự cố. Thử lại sau ít phút nhé.');
  return new AiError('bad_response', 'AI chưa trả lời được. Thử lại nhé.');
}

export interface GenerateResult {
  text: string;
  /** Model thực sự đã trả lời (có thể là model dự phòng) */
  model: string;
}

/**
 * Gọi generateContent với cơ chế chống quá tải:
 *  - thử lần lượt model chính rồi các model dự phòng (mỗi model có hạn mức riêng),
 *  - hết một lượt mà vẫn quá tải thì đợi vài giây rồi thử thêm một lượt nữa,
 *  - model nào đã báo "không tồn tại" thì bỏ qua ở lượt sau.
 * Lỗi không thể tự khắc phục (key sai, mạng, nội dung bị chặn…) báo ngay.
 */
export async function generateText(options: GenerateOptions): Promise<GenerateResult> {
  if (getAiMode() !== 'gemini') throw new AiError('no_key', 'Trợ lý AI chưa sẵn sàng. Hãy dùng gợi ý cơ bản.');
  const primary = getModelName();
  let models = [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let lastError: AiError | null = null;

  for (let round = 0; round < ROUNDS; round++) {
    if (round > 0) await sleep(RETRY_DELAY_MS, options.signal);
    for (const model of models) {
      const left = deadline - Date.now();
      if (left < 3_000 || options.signal?.aborted) break;
      try {
        return { text: await callModel(model, options, Math.min(ATTEMPT_TIMEOUT_MS, left)), model };
      } catch (err) {
        if (!(err instanceof AiError) || !RETRYABLE.includes(err.kind)) throw err;
        lastError = err;
        if (err.kind === 'model') models = models.filter((m) => m !== model);
      }
    }
  }
  if (lastError?.kind === 'quota') throw lastError;
  throw new AiError('overloaded', 'AI đang quá tải. Thử lại sau ít phút nhé.');
}

/** Gọi một model cụ thể và trả về văn bản (đã ghép các part, bỏ phần "thought"). */
async function callModel(model: string, options: GenerateOptions, timeoutMs: number): Promise<string> {
  const body = {
    systemInstruction: { parts: [{ text: options.systemInstruction }] },
    contents: options.turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
    generationConfig: {
      temperature: options.temperature ?? 0.4,
      ...(options.responseSchema ? { responseMimeType: 'application/json', responseSchema: options.responseSchema } : {}),
    },
  };

  // Timeout + cho phép nơi gọi hủy (ví dụ người dùng rời trang)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  const onAbort = () => controller.abort('cancelled');
  options.signal?.addEventListener('abort', onAbort);

  let res: Response;
  try {
    res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, request: body }),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.reason === 'timeout')
      throw new AiError('timeout', 'AI phản hồi quá lâu. Thử lại nhé.');
    throw new AiError('network', 'Không kết nối được. Kiểm tra mạng Internet rồi thử lại.');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }

  let json: GeminiResponse;
  try {
    json = (await res.json()) as GeminiResponse;
  } catch {
    throw new AiError('bad_response', 'AI trả lời không đúng định dạng. Thử lại nhé.');
  }
  if (!res.ok) throw errorFromStatus(res.status, json.error?.message ?? '', model);

  if (json.promptFeedback?.blockReason) {
    throw new AiError('blocked', 'AI không trả lời được câu này. Thử diễn đạt lại nhé.');
  }
  const candidate = json.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('')
    .trim();
  if (!text) {
    if (candidate?.finishReason === 'SAFETY') throw new AiError('blocked', 'AI không trả lời được câu này. Thử diễn đạt lại nhé.');
    throw new AiError('bad_response', 'AI chưa trả lời được. Thử lại nhé.');
  }
  return text;
}

/** Gọi Gemini ở chế độ JSON và parse kết quả. Phần kiểm tra nội dung do nơi gọi đảm nhận. */
export async function generateJson<T>(
  options: GenerateOptions & { responseSchema: Record<string, unknown> },
): Promise<{ value: T; model: string }> {
  const { text, model } = await generateText({ temperature: 0.2, ...options });
  try {
    // Phòng trường hợp model bọc JSON trong ```json ... ```
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    return { value: JSON.parse(cleaned) as T, model };
  } catch {
    throw new AiError('bad_response', 'AI trả lời không đúng định dạng. Thử lại nhé.');
  }
}

/** Đổi lỗi bất kỳ thành thông báo hiển thị được */
export function describeAiError(err: unknown): string {
  if (err instanceof AiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Đã có lỗi không xác định khi gọi AI.';
}
