/**
 * Xử lý phía SERVER cho các API cần khóa bí mật (Gemini, YouTube).
 *
 * Vì sao cần server? Khi web được deploy lên Internet, mọi thứ trong bundle JS ai cũng đọc được.
 * Để API key không lộ, trình duyệt chỉ gọi /api/... của chính web này; server đọc key từ biến môi trường
 * rồi mới gọi Google. Cùng một file này được dùng ở 2 nơi:
 *   - `npm run dev`: plugin trong vite.config.ts gắn các hàm này vào dev server.
 *   - Vercel: các file trong thư mục `api/` gọi lại các hàm này (serverless function).
 *
 * Mỗi hàm nhận biến môi trường + dữ liệu đầu vào và trả về { status, body } – không phụ thuộc framework.
 */

export interface ServerEnv {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  YOUTUBE_API_KEY?: string;
}

export interface HandlerResult {
  status: number;
  body: unknown;
}

const DEFAULT_MODEL = 'gemini-flash-lite-latest';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
/** Chỉ cho phép tên model hợp lệ – không để ai dùng proxy gọi đường dẫn tùy ý */
const MODEL_PATTERN = /^gemini-[a-z0-9.-]{1,60}$/;

const clean = (v: string | undefined) => (v ?? '').trim();

/** GET /api/config – cho trình duyệt biết tính năng nào đã bật (KHÔNG trả về key). */
export function handleConfig(env: ServerEnv): HandlerResult {
  return {
    status: 200,
    body: {
      gemini: clean(env.GEMINI_API_KEY) !== '',
      model: clean(env.GEMINI_MODEL) || DEFAULT_MODEL,
      youtube: clean(env.YOUTUBE_API_KEY) !== '',
    },
  };
}

/** POST /api/gemini  { model, request } – chuyển tiếp nguyên văn tới generateContent. */
export async function handleGemini(env: ServerEnv, payload: unknown, signal?: AbortSignal): Promise<HandlerResult> {
  const key = clean(env.GEMINI_API_KEY);
  if (!key) return { status: 501, body: { error: { status: 'NO_KEY', message: 'Server chưa cấu hình GEMINI_API_KEY.' } } };

  const p = (payload ?? {}) as { model?: unknown; request?: unknown };
  const model = typeof p.model === 'string' ? p.model : '';
  if (!MODEL_PATTERN.test(model) || typeof p.request !== 'object' || p.request === null) {
    return { status: 400, body: { error: { status: 'BAD_REQUEST', message: 'Yêu cầu không hợp lệ.' } } };
  }

  try {
    const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(p.request),
      signal,
    });
    const body = await res.json().catch(() => ({ error: { message: 'Phản hồi từ Gemini không đọc được.' } }));
    return { status: res.status, body };
  } catch {
    return { status: 502, body: { error: { status: 'UPSTREAM', message: 'Server không kết nối được tới Gemini.' } } };
  }
}

export interface VideoResult {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
}

/** GET /api/youtube-search?q=... – tìm video YouTube (YouTube Data API v3). */
export async function handleYoutubeSearch(env: ServerEnv, query: string): Promise<HandlerResult> {
  const key = clean(env.YOUTUBE_API_KEY);
  if (!key) return { status: 501, body: { error: 'no_key' } };
  const q = query.trim().slice(0, 100);
  if (!q) return { status: 400, body: { error: 'empty_query' } };

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    maxResults: '12',
    safeSearch: 'moderate',
    q,
    key,
  });
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    const json = (await res.json()) as {
      items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; thumbnails?: { medium?: { url?: string } } } }>;
      error?: { message?: string };
    };
    if (!res.ok) return { status: res.status, body: { error: 'upstream', message: json.error?.message ?? '' } };
    const items: VideoResult[] = (json.items ?? [])
      .filter((it) => it.id?.videoId)
      .map((it) => ({
        id: it.id!.videoId!,
        title: decodeEntities(it.snippet?.title ?? ''),
        channel: decodeEntities(it.snippet?.channelTitle ?? ''),
        thumbnail: it.snippet?.thumbnails?.medium?.url ?? `https://i.ytimg.com/vi/${it.id!.videoId}/mqdefault.jpg`,
      }));
    return { status: 200, body: { items } };
  } catch {
    return { status: 502, body: { error: 'network' } };
  }
}

/** YouTube trả tiêu đề có &amp; &#39; … */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
