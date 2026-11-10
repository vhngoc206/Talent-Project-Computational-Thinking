/** Tiện ích YouTube: tách id từ link, video gợi ý, gọi API tìm kiếm qua server. */

const isId = (id: string | null | undefined): id is string => !!id && /^[\w-]{11}$/.test(id);

/** Lấy video id từ link YouTube (watch?v=, youtu.be/, shorts/, embed/, live/) hoặc chính id 11 ký tự. */
export function parseYouTubeId(input: string): string | null {
  const text = input.trim();
  if (isId(text)) return text;
  try {
    const url = new URL(text);
    const host = url.hostname.replace(/^(www|m|music)\./, '');
    if (host === 'youtu.be') {
      const id = url.pathname.slice(1);
      return isId(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const v = url.searchParams.get('v');
      if (isId(v)) return v;
      const m = url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/);
      if (m) return m[1];
    }
  } catch {
    /* không phải URL */
  }
  return null;
}

export interface VideoItem {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
}

export const thumbOf = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

/** Video gợi ý (đã kiểm tra còn tồn tại qua oEmbed của YouTube ngày 05/11/2026) */
export const SUGGESTED_VIDEOS: VideoItem[] = [
  { id: '3jWRrafhO7M', title: 'Relaxing Jazz & Bossa Nova – Studio Ghibli Cover', channel: 'Cafe Music BGM channel', thumbnail: thumbOf('3jWRrafhO7M') },
  { id: '5qap5aO4i9A', title: 'lofi hip hop radio – beats to relax/study to', channel: 'Lofi Girl', thumbnail: thumbOf('5qap5aO4i9A') },
  { id: 'lCOF9LN_Zxs', title: 'Beautiful Piano Music – Relaxing Music for Focus', channel: 'Soothing Relaxation', thumbnail: thumbOf('lCOF9LN_Zxs') },
  { id: 'eKFTSSKCzWA', title: 'Relaxing Nature Sounds – Forest Waterfall', channel: 'johnnielawson', thumbnail: thumbOf('eKFTSSKCzWA') },
  { id: 'yIQd2Ya0Ziw', title: 'Rainstorm Sounds for Relaxing, Focus or Deep Sleep', channel: 'Calm', thumbnail: thumbOf('yIQd2Ya0Ziw') },
];

export type SearchResult = { ok: true; items: VideoItem[] } | { ok: false; reason: 'no_key' | 'error'; message: string };

/** Tìm video qua /api/youtube-search (server giữ YOUTUBE_API_KEY). */
export async function searchYouTube(query: string): Promise<SearchResult> {
  try {
    const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(query)}`);
    const json = (await res.json().catch(() => ({}))) as { items?: VideoItem[]; error?: string; message?: string };
    if (res.status === 501 || json.error === 'no_key')
      return { ok: false, reason: 'no_key', message: 'Tìm kiếm tạm thời không khả dụng – hãy dán link YouTube hoặc chọn video gợi ý.' };
    if (!res.ok) return { ok: false, reason: 'error', message: 'Tìm kiếm chưa được, thử lại sau nhé.' };
    return { ok: true, items: json.items ?? [] };
  } catch {
    return { ok: false, reason: 'error', message: 'Không kết nối được máy chủ tìm kiếm.' };
  }
}
