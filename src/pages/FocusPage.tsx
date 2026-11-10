/**
 * FOCUS – trang Pomodoro riêng, toàn màn hình.
 * Lớp dưới: hình nền (ảnh Ghibli / ảnh tự tải lên / video YouTube). Lớp trên: đồng hồ + câu động lực.
 * Các bảng điều khiển (Nhiệm vụ, Âm thanh, Nhạc, Hình nền, Hẹn giờ) mở dạng thẻ nổi ở bên phải.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Image, ListTodo, Maximize, Minimize, Music, Pause, Play, RefreshCw, RotateCcw, SkipForward, Timer, Waves, X, type LucideIcon } from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { ghibliImage, ghibliSrc } from '../constants/ghibli';
import { QUOTES } from '../constants/quotes';
import { useAmbient } from '../features/focus/AmbientContext';
import { BackgroundPanel, MusicPanel, SoundsPanel, TasksPanel, TimerPanel } from '../features/focus/FocusPanels';
import { useFocusPrefs } from '../features/focus/focusPrefs';
import { clearBackground, loadBackground, saveBackground } from '../features/focus/mediaStore';
import { NowPlaying } from '../features/focus/NowPlaying';
import { YouTubePlayer, type YouTubeHandle } from '../features/focus/YouTubePlayer';
import type { VideoItem } from '../features/focus/youtube';
import { usePomodoro } from '../features/pomodoro/PomodoroContext';
import { formatClock, PHASE_LABEL, type PomodoroPhase } from '../features/pomodoro/pomodoroLogic';
import { routeHref } from '../hooks/useHashRoute';
import { cn } from '../utils/cn';

type PanelId = 'tasks' | 'sounds' | 'music' | 'background' | 'timer';
const PANELS: Array<{ id: PanelId; label: string; icon: LucideIcon }> = [
  { id: 'tasks', label: 'Nhiệm vụ', icon: ListTodo },
  { id: 'sounds', label: 'Âm thanh', icon: Waves },
  { id: 'music', label: 'Nhạc', icon: Music },
  { id: 'background', label: 'Hình nền', icon: Image },
  { id: 'timer', label: 'Hẹn giờ', icon: Timer },
];
const PHASES: PomodoroPhase[] = ['focus', 'short', 'long'];
const MAX_UPLOAD_MB = 15;

function GlassButton({ active, onClick, label, children, className }: { active?: boolean; onClick: () => void; label: string; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        'flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold backdrop-blur-md transition-colors',
        active ? 'bg-white text-ink' : 'bg-black/25 text-white hover:bg-black/40',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function FocusPage() {
  const p = usePomodoro();
  const ambient = useAmbient();
  const toast = useToast();
  const [prefs, update] = useFocusPrefs();
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [autoplayVideo, setAutoplayVideo] = useState(false);
  const player = useRef<YouTubeHandle>(null);
  /** Danh sách đang nghe (kết quả tìm kiếm / gợi ý) cho nút bài trước – bài sau */
  const [queue, setQueue] = useState<VideoItem[]>([]);

  // Ảnh tự tải lên lưu trong IndexedDB
  useEffect(() => {
    let url: string | null = null;
    void loadBackground().then((blob) => {
      if (blob) {
        url = URL.createObjectURL(blob);
        setUploadUrl(url);
      }
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  // Câu động lực đổi sau mỗi phút
  useEffect(() => {
    const id = window.setInterval(() => setQuoteIndex((i) => (i + 1) % QUOTES.length), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Phím tắt: Space = bắt đầu/tạm dừng, Esc = đóng bảng
  const toggleTimer = useCallback(() => {
    if (p.status === 'running') p.pause();
    else p.start();
  }, [p]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, button')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        toggleTimer();
      } else if (e.key === 'Escape') setPanel(null);
      else if (e.key === 'ArrowLeft') player.current?.seekBy(-10);
      else if (e.key === 'ArrowRight') player.current?.seekBy(10);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleTimer]);

  async function onUpload(file: File) {
    if (!file.type.startsWith('image/')) return toast('Chỉ nhận file ảnh (JPG, PNG, WEBP, GIF…).', 'error');
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return toast(`Ảnh tối đa ${MAX_UPLOAD_MB}MB.`, 'error');
    try {
      await saveBackground(file);
      setUploadUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(file);
      });
      update({ background: { kind: 'upload' } });
      toast('Đã đặt ảnh của bạn làm hình nền.');
    } catch {
      toast('Không lưu được ảnh trên trình duyệt này.', 'error');
    }
  }

  async function onRemoveUpload() {
    await clearBackground();
    setUploadUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    if (prefs.background.kind === 'upload') update({ background: { kind: 'image', id: 'totoro029' } });
  }

  function pickVideo(video: VideoItem, list: VideoItem[] = queue) {
    setAutoplayVideo(true);
    if (list.length) setQueue(list);
    update({ video, background: prefs.video ? prefs.background : { kind: 'youtube' } });
  }

  const queueIndex = prefs.video ? queue.findIndex((v) => v.id === prefs.video!.id) : -1;
  const prevVideo = queueIndex > 0 ? queue[queueIndex - 1] : undefined;
  const nextVideo = queueIndex >= 0 && queueIndex < queue.length - 1 ? queue[queueIndex + 1] : undefined;
  const onPrev = prevVideo ? () => pickVideo(prevVideo) : undefined;
  const onNext = nextVideo ? () => pickVideo(nextVideo) : undefined;
  const togglePlay = () => {
    setAutoplayVideo(true);
    if (videoPlaying) player.current?.pause();
    else player.current?.play();
  };

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => toast('Trình duyệt không cho phép toàn màn hình.', 'error'));
  }

  const bg = prefs.background;
  const showUpload = bg.kind === 'upload' && uploadUrl;
  const image = bg.kind === 'image' ? ghibliImage(bg.id) : ghibliImage('totoro029');
  const showVideo = bg.kind === 'youtube' && prefs.video;
  const progress = 1 - p.remainingSeconds / p.totalSeconds;
  const filledDots = p.completedFocus === 0 ? 0 : ((p.completedFocus - 1) % p.settings.longEvery) + 1;
  const pristine = p.status === 'idle' && p.remainingSeconds === p.totalSeconds;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#1f2a22] text-white">
      {/* ── Lớp nền ── */}
      {prefs.video && (
        <YouTubePlayer
          ref={player}
          videoId={prefs.video.id}
          volume={prefs.videoVolume}
          autoplay={autoplayVideo}
          loop={prefs.loop}
          onEnded={onNext}
          onPlayingChange={setVideoPlaying}
          onTitle={(title) => {
            if (prefs.video && prefs.video.title !== title) update({ video: { ...prefs.video, title } });
          }}
          onError={(m) => toast(m, 'error')}
        />
      )}
      {!showVideo && (
        <div className="absolute inset-0 overflow-hidden">
          {showUpload ? (
            <img src={uploadUrl} alt="Hình nền của bạn" className="h-full w-full object-cover" />
          ) : (
            <img
              key={image.id}
              src={ghibliSrc(image.id)}
              alt={`${image.label} – phim Totoro (Studio Ghibli)`}
              className="anim-ken-burns h-full w-full object-cover"
              style={{ objectPosition: image.focus }}
            />
          )}
        </div>
      )}
      <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: `rgb(10 16 12 / ${prefs.dim})` }} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40" />

      {/* ── Thanh trên ── */}
      <header className="absolute inset-x-0 top-0 z-20 flex flex-wrap items-center justify-between gap-2 p-3 sm:p-5">
        <a href={routeHref('dashboard')} className="flex h-10 items-center gap-2 rounded-xl bg-black/25 px-3 text-sm font-bold backdrop-blur-md hover:bg-black/40">
          <ArrowLeft className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">SmartStudy</span>
        </a>
        <nav className="flex flex-wrap items-center justify-end gap-1.5" aria-label="Bảng điều khiển Focus">
          {PANELS.map(({ id, label, icon: Icon }) => (
            <GlassButton key={id} active={panel === id} onClick={() => setPanel(panel === id ? null : id)} label={label}>
              <Icon className="h-4 w-4" aria-hidden />
              <span className="hidden md:inline">{label}</span>
              {id === 'sounds' && ambient.playingCount > 0 && <span className="h-2 w-2 rounded-full bg-[#b9d79f]" aria-hidden />}
              {id === 'music' && videoPlaying && <span className="h-2 w-2 rounded-full bg-[#b9d79f]" aria-hidden />}
            </GlassButton>
          ))}
          <GlassButton onClick={toggleFullscreen} label={fullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}>
            {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </GlassButton>
        </nav>
      </header>

      {/* ── Đồng hồ ── */}
      <main className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center">
        <div className="flex gap-1 rounded-full bg-black/25 p-1 backdrop-blur-md" role="tablist" aria-label="Chọn pha">
          {PHASES.map((ph) => (
            <button
              key={ph}
              type="button"
              role="tab"
              aria-selected={p.phase === ph}
              onClick={() => p.selectPhase(ph)}
              className={cn('rounded-full px-3.5 py-1.5 text-xs font-extrabold transition-colors sm:text-sm', p.phase === ph ? 'bg-white text-ink' : 'text-white/85 hover:bg-white/15')}
            >
              {PHASE_LABEL[ph]}
            </button>
          ))}
        </div>

        <p
          className="mt-4 font-black leading-none tracking-tight tabular-nums [text-shadow:0_4px_30px_rgb(0_0_0/0.35)]"
          style={{ fontSize: 'clamp(4.5rem, 18vw, 11rem)' }}
          role="timer"
          aria-live="off"
          aria-label={`Còn ${formatClock(p.remainingSeconds)}`}
        >
          {formatClock(p.remainingSeconds)}
        </p>

        <div className="mt-2 h-1 w-56 overflow-hidden rounded-full bg-white/25 sm:w-72" aria-hidden>
          <div className="h-full rounded-full bg-white transition-[width] duration-300" style={{ width: `${Math.min(100, progress * 100)}%` }} />
        </div>

        <div className="mt-6 flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTimer}
            className="flex h-12 items-center gap-2 rounded-full bg-white px-7 text-base font-black text-ink shadow-lg transition-transform hover:scale-[1.03]"
          >
            {p.status === 'running' ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            {p.status === 'running' ? 'Tạm dừng' : p.status === 'paused' ? 'Tiếp tục' : 'Bắt đầu'}
          </button>
          <button type="button" onClick={p.reset} disabled={pristine} className="flex h-12 w-12 items-center justify-center rounded-full bg-black/25 backdrop-blur-md hover:bg-black/40 disabled:opacity-40" aria-label="Đặt lại" title="Đặt lại">
            <RotateCcw className="h-5 w-5" />
          </button>
          <button type="button" onClick={p.skip} className="flex h-12 w-12 items-center justify-center rounded-full bg-black/25 backdrop-blur-md hover:bg-black/40" aria-label="Bỏ qua sang pha tiếp theo" title="Bỏ qua">
            <SkipForward className="h-5 w-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setPanel('tasks')}
          className="mt-5 max-w-[90vw] truncate rounded-full bg-black/25 px-4 py-1.5 text-sm font-bold backdrop-blur-md hover:bg-black/40"
        >
          {p.activeTask ? `📖 ${p.activeTask.title}` : '＋ Chọn nhiệm vụ để ghi nhận giờ học'}
        </button>

        <div className="mt-3 flex gap-1.5" aria-label={`Đã xong ${filledDots}/${p.settings.longEvery} phiên trước nghỉ dài`}>
          {Array.from({ length: p.settings.longEvery }, (_, i) => (
            <span key={i} className={cn('h-2 w-2 rounded-full', i < filledDots ? 'bg-white' : 'bg-white/30')} />
          ))}
        </div>
      </main>

      {/* ── Câu động lực ── */}
      <footer className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-2 p-4 sm:p-6">
        <p className="max-w-2xl text-center font-serif text-base italic text-white/95 [text-shadow:0_2px_12px_rgb(0_0_0/0.5)] sm:text-lg">“{QUOTES[quoteIndex]}”</p>
        <button type="button" onClick={() => setQuoteIndex((i) => (i + 1) % QUOTES.length)} className="rounded-full p-1.5 text-white/80 hover:bg-white/15" aria-label="Câu khác" title="Câu khác">
          <RefreshCw className="h-4 w-4" />
        </button>
      </footer>

      {/* ── Trình phát thu gọn ── */}
      {prefs.video && panel !== 'music' && (
        <div className="absolute bottom-16 left-3 z-20 sm:bottom-6 sm:left-5">
          <NowPlaying
            compact
            player={player}
            video={prefs.video}
            playing={videoPlaying}
            onPlayPause={togglePlay}
            loop={prefs.loop}
            onToggleLoop={() => update({ loop: !prefs.loop })}
            onPrev={onPrev}
            onNext={onNext}
            volume={prefs.videoVolume}
            onVolume={(v) => update({ videoVolume: v })}
          />
        </div>
      )}

      {/* ── Bảng điều khiển ── */}
      {panel && (
        <aside
          className="anim-pop-in absolute inset-x-3 bottom-3 top-auto z-30 max-h-[70dvh] overflow-y-auto rounded-2xl bg-white/90 p-4 text-ink shadow-pop backdrop-blur-xl sm:inset-x-auto sm:bottom-auto sm:right-5 sm:top-20 sm:max-h-[calc(100dvh-7rem)] sm:w-[360px]"
          aria-label={PANELS.find((x) => x.id === panel)?.label}
        >
          <button type="button" onClick={() => setPanel(null)} className="absolute right-3 top-3 rounded-md p-1 text-ink-mute hover:bg-black/5" aria-label="Đóng">
            <X className="h-4 w-4" />
          </button>
          {panel === 'tasks' && <TasksPanel />}
          {panel === 'sounds' && <SoundsPanel />}
          {panel === 'music' && (
            <MusicPanel
              prefs={prefs}
              update={update}
              playing={videoPlaying}
              onPlayPause={togglePlay}
              onPick={pickVideo}
              player={player}
              onPrev={onPrev}
              onNext={onNext}
            />
          )}
          {panel === 'background' && <BackgroundPanel prefs={prefs} update={update} hasUpload={!!uploadUrl} onUpload={(f) => void onUpload(f)} onRemoveUpload={() => void onRemoveUpload()} />}
          {panel === 'timer' && <TimerPanel />}
        </aside>
      )}
    </div>
  );
}
