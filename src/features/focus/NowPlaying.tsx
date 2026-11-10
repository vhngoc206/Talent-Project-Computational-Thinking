/** Bộ điều khiển nhạc YouTube giống trình phát của YouTube: thanh tua, tua 10 giây, tốc độ, lặp lại, bài trước/sau, âm lượng. */
import { useEffect, useState, type RefObject } from 'react';
import { Gauge, Pause, Play, Repeat, Repeat1, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from 'lucide-react';
import { cn } from '../../utils/cn';
import { thumbOf, type VideoItem } from './youtube';
import type { PlaybackState, YouTubeHandle } from './YouTubePlayer';

const DEFAULT_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

/** 3725 -> "1:02:05", 65 -> "1:05" */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Đọc trạng thái phát mỗi nửa giây để vẽ thanh tua */
function usePlayback(player: RefObject<YouTubeHandle | null>, videoId: string): PlaybackState | null {
  const [state, setState] = useState<PlaybackState | null>(null);
  useEffect(() => {
    setState(null);
    const tick = () => setState(player.current?.getState() ?? null);
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [player, videoId]);
  return state;
}

interface Props {
  player: RefObject<YouTubeHandle | null>;
  video: VideoItem;
  playing: boolean;
  onPlayPause: () => void;
  loop: boolean;
  onToggleLoop: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  volume: number;
  onVolume: (v: number) => void;
  /** Bản thu gọn hiện ở góc màn hình Focus */
  compact?: boolean;
}

const iconBtn = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-35';

export function NowPlaying({ player, video, playing, onPlayPause, loop, onToggleLoop, onPrev, onNext, volume, onVolume, compact }: Props) {
  const pb = usePlayback(player, video.id);
  const [scrub, setScrub] = useState<number | null>(null);
  const [speedOpen, setSpeedOpen] = useState(false);
  const duration = pb?.duration ?? 0;
  const current = scrub ?? pb?.current ?? 0;
  const pct = duration > 0 ? (current / duration) * 100 : 0;
  const buffered = (pb?.buffered ?? 0) * 100;
  const rates = pb?.rates && pb.rates.length > 1 ? pb.rates : DEFAULT_RATES;
  const rate = pb?.rate ?? 1;
  const dark = compact; // bản thu gọn nằm trên nền ảnh/video => chữ trắng
  const btn = cn(iconBtn, dark ? 'text-white hover:bg-white/15' : 'text-ink hover:bg-black/5');
  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  const seekBar = (
    <div className="group relative flex h-4 items-center">
      {/* Nền, phần đã tải, phần đã phát */}
      <div className={cn('absolute inset-x-0 h-1 rounded-full', dark ? 'bg-white/25' : 'bg-black/10')} />
      <div className={cn('absolute left-0 h-1 rounded-full', dark ? 'bg-white/40' : 'bg-black/15')} style={{ width: `${buffered}%` }} />
      <div className="absolute left-0 h-1 rounded-full bg-[#e5483c]" style={{ width: `${pct}%` }} />
      <div className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 rounded-full bg-[#e5483c] opacity-0 shadow transition-opacity group-hover:opacity-100" style={{ left: `${pct}%` }} />
      <input
        type="range"
        min={0}
        max={Math.max(1, duration)}
        step={1}
        value={Math.min(current, duration || 1)}
        disabled={!duration}
        onChange={(e) => setScrub(Number(e.target.value))}
        onPointerUp={() => {
          if (scrub !== null) player.current?.seekTo(scrub);
          setScrub(null);
        }}
        onKeyUp={() => {
          if (scrub !== null) player.current?.seekTo(scrub);
          setScrub(null);
        }}
        className="absolute inset-0 h-4 w-full cursor-pointer opacity-0"
        aria-label="Tua video"
        aria-valuetext={`${formatTime(current)} / ${formatTime(duration)}`}
      />
    </div>
  );

  if (compact) {
    return (
      <div className="w-[min(92vw,380px)] rounded-2xl bg-black/35 p-3 text-white backdrop-blur-md">
        <div className="mb-1.5 flex items-center gap-2.5">
          <img src={video.thumbnail || thumbOf(video.id)} alt="" className="h-8 w-12 shrink-0 rounded object-cover" />
          <p className="min-w-0 flex-1 truncate text-xs font-bold">{video.title}</p>
        </div>
        {seekBar}
        <div className="mt-1 flex items-center gap-1">
          <button type="button" className={btn} onClick={onPrev} disabled={!onPrev} aria-label="Bài trước">
            <SkipBack className="h-4 w-4" />
          </button>
          <button type="button" className={btn} onClick={onPlayPause} aria-label={playing ? 'Tạm dừng nhạc' : 'Phát nhạc'}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button type="button" className={btn} onClick={onNext} disabled={!onNext} aria-label="Bài tiếp theo">
            <SkipForward className="h-4 w-4" />
          </button>
          <span className="ml-1 text-[11px] font-semibold tabular-nums text-white/85">
            {formatTime(current)} / {formatTime(duration)}
          </span>
          {rate !== 1 && <span className="ml-auto rounded bg-white/20 px-1.5 text-[10px] font-extrabold">{rate}×</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-cream p-3">
      <div className="mb-2 flex items-center gap-2.5">
        <img src={video.thumbnail || thumbOf(video.id)} alt="" className="h-10 w-16 shrink-0 rounded-md object-cover" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs font-extrabold leading-snug text-ink">{video.title}</p>
          <p className="truncate text-[11px] text-ink-mute">{video.channel || 'YouTube'}</p>
        </div>
      </div>

      {seekBar}
      <div className="mt-0.5 flex justify-between text-[11px] font-semibold tabular-nums text-ink-mute">
        <span>{formatTime(current)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Hàng nút giống YouTube */}
      <div className="mt-1 flex items-center justify-center gap-1">
        <button type="button" className={btn} onClick={onToggleLoop} aria-pressed={loop} aria-label={loop ? 'Đang lặp lại bài này' : 'Không lặp lại'} title={loop ? 'Lặp lại bài này' : 'Phát xong chuyển bài'}>
          {loop ? <Repeat1 className="h-4 w-4 text-brand-deep" /> : <Repeat className="h-4 w-4 text-ink-mute" />}
        </button>
        <button type="button" className={btn} onClick={onPrev} disabled={!onPrev} aria-label="Bài trước">
          <SkipBack className="h-4 w-4" />
        </button>
        <button type="button" className={cn(btn, 'text-xs font-black')} onClick={() => player.current?.seekBy(-10)} aria-label="Tua lại 10 giây" title="Tua lại 10 giây">
          -10
        </button>
        <button type="button" onClick={onPlayPause} className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white" aria-label={playing ? 'Tạm dừng nhạc' : 'Phát nhạc'}>
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <button type="button" className={cn(btn, 'text-xs font-black')} onClick={() => player.current?.seekBy(10)} aria-label="Tua tới 10 giây" title="Tua tới 10 giây">
          +10
        </button>
        <button type="button" className={btn} onClick={onNext} disabled={!onNext} aria-label="Bài tiếp theo">
          <SkipForward className="h-4 w-4" />
        </button>
        <div className="relative">
          <button type="button" className={cn(btn, 'w-auto gap-0.5 px-2 text-[11px] font-extrabold')} onClick={() => setSpeedOpen((o) => !o)} aria-expanded={speedOpen} aria-label="Tốc độ phát" title="Tốc độ phát">
            <Gauge className="h-4 w-4" aria-hidden /> {rate}×
          </button>
          {speedOpen && (
            <div className="absolute bottom-9 right-0 z-10 w-28 rounded-xl bg-white p-1 shadow-pop" role="menu">
              <p className="px-2 py-1 text-[10px] font-bold uppercase text-ink-mute">Tốc độ</p>
              {rates.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="menuitemradio"
                  aria-checked={r === rate}
                  onClick={() => {
                    player.current?.setRate(r);
                    setSpeedOpen(false);
                  }}
                  className={cn('block w-full rounded-lg px-2 py-1 text-left text-xs font-bold', r === rate ? 'bg-brand-tint text-brand-deep' : 'text-ink-soft hover:bg-cream')}
                >
                  {r === 1 ? 'Chuẩn' : `${r}×`}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button type="button" className={cn(iconBtn, 'h-6 w-6 text-ink-mute hover:bg-black/5')} onClick={() => onVolume(volume === 0 ? 0.6 : 0)} aria-label={volume === 0 ? 'Bật tiếng' : 'Tắt tiếng'}>
          <VolumeIcon className="h-3.5 w-3.5" />
        </button>
        <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => onVolume(Number(e.target.value))} className="h-1.5 w-full cursor-pointer accent-[#4f8a4b]" aria-label="Âm lượng nhạc" />
      </div>
    </div>
  );
}
