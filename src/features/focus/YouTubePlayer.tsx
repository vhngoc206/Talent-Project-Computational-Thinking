/**
 * Trình phát YouTube làm nền (YouTube IFrame Player API – cách nhúng chính thức của YouTube).
 * Video được phóng to phủ kín khung (giống background-size: cover), không nhận chuột;
 * điều khiển phát/dừng/âm lượng nằm ở bảng "Nhạc" của trang Focus.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

interface YTPlayer {
  loadVideoById(id: string): void;
  cueVideoById(id: string): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(v: number): void;
  getVideoData(): { title?: string; author?: string };
  getCurrentTime(): number;
  getDuration(): number;
  getPlaybackRate(): number;
  setPlaybackRate(rate: number): void;
  getAvailablePlaybackRates(): number[];
  getVideoLoadedFraction(): number;
  destroy(): void;
}
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId?: string;
      playerVars?: Record<string, number | string>;
      events?: { onReady?: () => void; onStateChange?: (e: { data: number }) => void; onError?: (e: { data: number }) => void };
    },
  ) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;
function loadApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        if (window.YT) resolve(window.YT);
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        apiPromise = null;
        reject(new Error('Không tải được YouTube'));
      };
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

/** Trạng thái phát hiện tại (đọc định kỳ để vẽ thanh tua) */
export interface PlaybackState {
  current: number;
  duration: number;
  buffered: number;
  rate: number;
  rates: number[];
}

export interface YouTubeHandle {
  play: () => void;
  pause: () => void;
  /** Tua tới giây thứ `seconds` */
  seekTo: (seconds: number) => void;
  /** Tua tới/lui `delta` giây */
  seekBy: (delta: number) => void;
  setRate: (rate: number) => void;
  getState: () => PlaybackState | null;
}

interface Props {
  videoId: string;
  volume: number;
  /** Tự phát khi đổi video (người dùng vừa bấm chọn) */
  autoplay: boolean;
  /** Hết video thì phát lại từ đầu */
  loop: boolean;
  /** Hết video (khi không lặp) – để chuyển bài tiếp theo */
  onEnded?: () => void;
  onPlayingChange: (playing: boolean) => void;
  onTitle?: (title: string) => void;
  onError: (message: string) => void;
}

const ERRORS: Record<number, string> = {
  2: 'Link video không hợp lệ.',
  5: 'Trình duyệt không phát được video này.',
  100: 'Video không tồn tại hoặc đã bị xóa.',
  101: 'Chủ video không cho phép phát trên trang web khác.',
  150: 'Chủ video không cho phép phát trên trang web khác.',
};

export const YouTubePlayer = forwardRef<YouTubeHandle, Props>(function YouTubePlayer({ videoId, volume, autoplay, loop, onEnded, onPlayingChange, onTitle, onError }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);
  const latest = useRef({ videoId, volume, autoplay, loop, onEnded, onPlayingChange, onTitle, onError });
  latest.current = { videoId, volume, autoplay, loop, onEnded, onPlayingChange, onTitle, onError };

  useImperativeHandle(ref, () => ({
    play: () => playerRef.current?.playVideo(),
    pause: () => playerRef.current?.pauseVideo(),
    seekTo: (seconds) => playerRef.current?.seekTo(Math.max(0, seconds), true),
    seekBy: (delta) => {
      const p = playerRef.current;
      if (!p || !readyRef.current) return;
      const target = Math.min(Math.max(0, p.getCurrentTime() + delta), Math.max(0, p.getDuration() - 1));
      p.seekTo(target, true);
    },
    setRate: (rate) => playerRef.current?.setPlaybackRate(rate),
    getState: () => {
      const p = playerRef.current;
      if (!p || !readyRef.current) return null;
      try {
        return {
          current: p.getCurrentTime() || 0,
          duration: p.getDuration() || 0,
          buffered: p.getVideoLoadedFraction() || 0,
          rate: p.getPlaybackRate() || 1,
          rates: p.getAvailablePlaybackRates() ?? [1],
        };
      } catch {
        return null;
      }
    },
  }));

  // Tạo player một lần
  useEffect(() => {
    let cancelled = false;
    const mount = document.createElement('div');
    hostRef.current?.appendChild(mount);
    loadApi()
      .then((YT) => {
        if (cancelled) return;
        playerRef.current = new YT.Player(mount, {
          videoId: latest.current.videoId,
          playerVars: { autoplay: latest.current.autoplay ? 1 : 0, controls: 0, disablekb: 1, modestbranding: 1, playsinline: 1, rel: 0, iv_load_policy: 3, fs: 0 },
          events: {
            onReady: () => {
              readyRef.current = true;
              playerRef.current?.setVolume(Math.round(latest.current.volume * 100));
            },
            onStateChange: (e) => {
              if (e.data === YT.PlayerState.PLAYING) {
                latest.current.onPlayingChange(true);
                const title = playerRef.current?.getVideoData().title;
                if (title) latest.current.onTitle?.(title);
              } else if (e.data === YT.PlayerState.PAUSED) latest.current.onPlayingChange(false);
              else if (e.data === YT.PlayerState.ENDED) {
                latest.current.onPlayingChange(false);
                if (latest.current.loop) {
                  playerRef.current?.seekTo(0, true); // phát lặp lại
                  playerRef.current?.playVideo();
                } else latest.current.onEnded?.();
              }
            },
            onError: (e) => {
              latest.current.onPlayingChange(false);
              latest.current.onError(ERRORS[e.data] ?? 'Không phát được video này.');
            },
          },
        });
      })
      .catch(() => latest.current.onError('Không tải được YouTube – kiểm tra kết nối mạng.'));
    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      readyRef.current = false;
      mount.remove();
    };
  }, []);

  // Đổi video
  const firstVideo = useRef(videoId);
  useEffect(() => {
    if (videoId === firstVideo.current) return;
    firstVideo.current = videoId;
    if (!readyRef.current || !playerRef.current) return;
    if (latest.current.autoplay) playerRef.current.loadVideoById(videoId);
    else playerRef.current.cueVideoById(videoId);
  }, [videoId]);

  useEffect(() => {
    if (readyRef.current) playerRef.current?.setVolume(Math.round(volume * 100));
  }, [volume]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Tỉ lệ 16:9 phủ kín màn hình */}
      <div
        ref={hostRef}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 [&_iframe]:h-full [&_iframe]:w-full"
        style={{ width: 'max(100%, 177.78vh)', height: 'max(100%, 56.25vw)' }}
      />
    </div>
  );
});
