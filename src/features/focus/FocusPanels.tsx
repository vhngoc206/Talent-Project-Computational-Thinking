/** Các bảng điều khiển nổi của trang Focus: Nhiệm vụ · Âm thanh · Nhạc YouTube · Hình nền · Hẹn giờ. */
import { useMemo, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { Bell, Check, ImagePlus, Link2, Loader2, Plus, Search, Trash2, Volume2, VolumeX } from 'lucide-react';
import { rankTasks } from '../../algorithms/priorityScheduler';
import { useToast } from '../../components/ui/Toast';
import { GHIBLI_IMAGES, ghibliThumb } from '../../constants/ghibli';
import { useAppState } from '../../state/AppStateContext';
import { cn } from '../../utils/cn';
import { atTime, formatMinutes } from '../../utils/date';
import { validateTask } from '../../utils/validation';
import { usePomodoro } from '../pomodoro/PomodoroContext';
import { PHASE_LABEL, type BellSound, type PomodoroPhase } from '../pomodoro/pomodoroLogic';
import { useAmbient } from './AmbientContext';
import { AMBIENT_SOUNDS } from './ambientSounds';
import type { FocusPrefs } from './focusPrefs';
import { NowPlaying } from './NowPlaying';
import { parseYouTubeId, searchYouTube, SUGGESTED_VIDEOS, thumbOf, type VideoItem } from './youtube';
import type { YouTubeHandle } from './YouTubePlayer';

export function PanelTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-extrabold text-ink">{children}</h2>
      {hint && <p className="text-xs text-ink-mute">{hint}</p>}
    </div>
  );
}

const range = 'h-1.5 w-full cursor-pointer accent-[#4f8a4b]';

// ───────────────────────── Nhiệm vụ ─────────────────────────
export function TasksPanel() {
  const { data, actions } = useAppState();
  const p = usePomodoro();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const ranked = useMemo(() => rankTasks(data.tasks, new Date()), [data.tasks]);
  const subjectById = new Map(data.subjects.map((s) => [s.id, s]));

  function quickAdd(e: FormEvent) {
    e.preventDefault();
    const input = {
      title,
      subjectId: data.subjects[0]?.id ?? '',
      description: '',
      deadline: atTime(new Date(), 0, 23, 59).toISOString(),
      estimatedMinutes: p.settings.minutes.focus,
      actualMinutes: 0,
      difficulty: 'medium' as const,
      importance: 'medium' as const,
      status: 'todo' as const,
    };
    const result = validateTask(input, data.subjects);
    if (!result.valid) {
      toast(result.errors.title ?? result.errors.subjectId ?? 'Dữ liệu chưa hợp lệ.', 'error');
      return;
    }
    const task = actions.addTask(input);
    p.setTaskId(task.id);
    setTitle('');
    toast('Đã thêm và chọn nhiệm vụ (hạn 23:59 hôm nay).');
  }

  return (
    <div>
      <PanelTitle hint="Chọn nhiệm vụ đang học – hết mỗi phiên tập trung sẽ tự cộng giờ học.">Nhiệm vụ</PanelTitle>
      <form onSubmit={quickAdd} className="mb-3 flex gap-2">
        <label htmlFor="focus-quick-task" className="sr-only">
          Thêm nhanh nhiệm vụ
        </label>
        <input id="focus-quick-task" className="input-base h-9" placeholder="Thêm nhanh nhiệm vụ…" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        <button type="submit" disabled={!title.trim()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-ink hover:bg-brand-hover disabled:opacity-50" aria-label="Thêm">
          <Plus className="h-4 w-4" />
        </button>
      </form>
      {ranked.length === 0 ? (
        <p className="rounded-xl bg-cream px-3 py-4 text-center text-sm text-ink-soft">Không còn nhiệm vụ nào. Tuyệt vời! 🎉</p>
      ) : (
        <ul className="space-y-1">
          {ranked.map(({ task }) => {
            const active = p.taskId === task.id;
            const subject = subjectById.get(task.subjectId);
            const left = Math.max(0, task.estimatedMinutes - task.actualMinutes);
            return (
              <li key={task.id} className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5', active ? 'bg-brand-tint' : 'hover:bg-black/[0.04]')}>
                <button
                  type="button"
                  onClick={() => {
                    actions.setTaskStatus(task.id, 'completed');
                    toast(`Đã hoàn thành "${task.title}".`);
                  }}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-line-strong text-transparent hover:border-brand-deep hover:text-brand-deep"
                  aria-label={`Đánh dấu hoàn thành: ${task.title}`}
                  title="Đánh dấu hoàn thành"
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </button>
                <button type="button" onClick={() => p.setTaskId(active ? '' : task.id)} className="min-w-0 flex-1 text-left" aria-pressed={active}>
                  <span className="block truncate text-sm font-bold text-ink">{task.title}</span>
                  <span className="flex items-center gap-1.5 text-[11px] text-ink-mute">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: subject?.color }} aria-hidden />
                    {subject?.code} · còn {formatMinutes(left)}
                  </span>
                </button>
                {active && <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[10px] font-extrabold text-ink">Đang học</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ───────────────────────── Âm thanh thiên nhiên ─────────────────────────
export function SoundsPanel() {
  const { volumes, setVolume, toggle, stopAll, playingCount } = useAmbient();
  return (
    <div>
      <PanelTitle hint="Bật nhiều âm thanh cùng lúc để tự trộn. Âm thanh vẫn phát khi bạn chuyển trang.">Âm thanh thiên nhiên</PanelTitle>
      <ul className="space-y-2">
        {AMBIENT_SOUNDS.map((s) => {
          const v = volumes[s.id] ?? 0;
          const on = v > 0;
          return (
            <li key={s.id} className={cn('rounded-xl px-3 py-2', on ? 'bg-brand-tint' : 'bg-cream')} title={s.credit}>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => toggle(s.id)} className="flex flex-1 items-center gap-2 text-left text-sm font-bold" aria-pressed={on}>
                  <span className="text-lg" aria-hidden>
                    {s.emoji}
                  </span>
                  {s.label}
                </button>
                {on ? <Volume2 className="h-4 w-4 text-brand-deep" aria-hidden /> : <VolumeX className="h-4 w-4 text-ink-mute" aria-hidden />}
              </div>
              {on && (
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={v}
                  onChange={(e) => setVolume(s.id, Number(e.target.value))}
                  className={cn(range, 'mt-2')}
                  aria-label={`Âm lượng ${s.label}`}
                />
              )}
            </li>
          );
        })}
      </ul>
      {playingCount > 0 && (
        <button type="button" onClick={stopAll} className="mt-3 text-xs font-extrabold text-brand-deep hover:underline">
          Tắt tất cả âm thanh
        </button>
      )}
    </div>
  );
}

// ───────────────────────── Nhạc YouTube ─────────────────────────
interface MusicProps {
  prefs: FocusPrefs;
  update: (patch: Partial<FocusPrefs>) => void;
  playing: boolean;
  onPlayPause: () => void;
  /** Chọn video mới (sẽ tự phát); `list` = danh sách chứa video đó, dùng cho bài trước/sau */
  onPick: (video: VideoItem, list: VideoItem[]) => void;
  player: RefObject<YouTubeHandle | null>;
  onPrev?: () => void;
  onNext?: () => void;
}

export function MusicPanel({ prefs, update, playing, onPlayPause, onPick, player, onPrev, onNext }: MusicProps) {
  const [query, setQuery] = useState('');
  const [link, setLink] = useState('');
  const [state, setState] = useState<{ status: 'idle' | 'loading' } | { status: 'done'; items: VideoItem[] } | { status: 'error'; message: string }>({ status: 'idle' });
  const toast = useToast();

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setState({ status: 'loading' });
    const res = await searchYouTube(query);
    setState(res.ok ? { status: 'done', items: res.items } : { status: 'error', message: res.message });
  }

  function onLink(e: FormEvent) {
    e.preventDefault();
    const id = parseYouTubeId(link);
    if (!id) {
      toast('Link YouTube không hợp lệ.', 'error');
      return;
    }
    onPick({ id, title: 'Video YouTube', channel: '', thumbnail: thumbOf(id) }, []);
    setLink('');
  }

  const list = state.status === 'done' ? state.items : SUGGESTED_VIDEOS;
  const video = prefs.video;

  return (
    <div>
      <PanelTitle hint="Tìm và phát nhạc ngay tại đây. Video có thể hiển thị làm hình nền, đồng hồ nằm phía trên.">Nhạc YouTube</PanelTitle>

      {video && (
        <div className="mb-3 space-y-2">
          <NowPlaying
            player={player}
            video={video}
            playing={playing}
            onPlayPause={onPlayPause}
            loop={prefs.loop}
            onToggleLoop={() => update({ loop: !prefs.loop })}
            onPrev={onPrev}
            onNext={onNext}
            volume={prefs.videoVolume}
            onVolume={(v) => update({ videoVolume: v })}
          />
          <div className="flex items-center justify-between gap-2 px-1">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-ink-soft">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#4f8a4b]"
                checked={prefs.background.kind === 'youtube'}
                onChange={(e) => update({ background: e.target.checked ? { kind: 'youtube' } : { kind: 'image', id: 'totoro029' } })}
              />
              Hiện video làm hình nền
            </label>
            <button
              type="button"
              onClick={() => update({ video: null, background: prefs.background.kind === 'youtube' ? { kind: 'image', id: 'totoro029' } : prefs.background })}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-ink-mute hover:bg-black/5"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Bỏ nhạc
            </button>
          </div>
        </div>
      )}

      <form onSubmit={onSearch} className="flex gap-2">
        <label htmlFor="yt-search" className="sr-only">
          Tìm trên YouTube
        </label>
        <input id="yt-search" className="input-base h-9" placeholder="Tìm: nhạc Ghibli piano, lofi…" value={query} maxLength={100} onChange={(e) => setQuery(e.target.value)} />
        <button type="submit" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-ink hover:bg-brand-hover" aria-label="Tìm">
          {state.status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </button>
      </form>
      <form onSubmit={onLink} className="mt-2 flex gap-2">
        <label htmlFor="yt-link" className="sr-only">
          Dán link YouTube
        </label>
        <input id="yt-link" className="input-base h-9" placeholder="…hoặc dán link YouTube" value={link} onChange={(e) => setLink(e.target.value)} />
        <button type="submit" disabled={!link.trim()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-ink hover:bg-cream disabled:opacity-50" aria-label="Phát link">
          <Link2 className="h-4 w-4" />
        </button>
      </form>

      {state.status === 'error' && <p className="mt-2 rounded-lg bg-warn-bg px-3 py-2 text-xs font-semibold text-warn-fg">{state.message}</p>}

      <p className="mb-1.5 mt-3 text-[11px] font-bold uppercase tracking-wide text-ink-mute">{state.status === 'done' ? `Kết quả (${list.length})` : 'Gợi ý'}</p>
      {list.length === 0 ? (
        <p className="text-xs text-ink-mute">Không tìm thấy video phù hợp.</p>
      ) : (
        <ul className="space-y-1">
          {list.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => onPick(v, list)}
                className={cn('flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-black/[0.04]', video?.id === v.id && 'bg-brand-tint')}
              >
                <img src={v.thumbnail} alt="" loading="lazy" className="h-10 w-16 shrink-0 rounded-md bg-cream object-cover" />
                <span className="min-w-0">
                  <span className="line-clamp-2 text-xs font-bold leading-snug text-ink">{v.title}</span>
                  <span className="block truncate text-[11px] text-ink-mute">{v.channel}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ───────────────────────── Hình nền ─────────────────────────
interface BackgroundProps {
  prefs: FocusPrefs;
  update: (patch: Partial<FocusPrefs>) => void;
  hasUpload: boolean;
  onUpload: (file: File) => void;
  onRemoveUpload: () => void;
}

export function BackgroundPanel({ prefs, update, hasUpload, onUpload, onRemoveUpload }: BackgroundProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const bg = prefs.background;
  const tile = 'relative aspect-video overflow-hidden rounded-lg ring-2 ring-offset-1 transition';

  return (
    <div>
      <PanelTitle hint="Chọn một khung cảnh hoặc tải ảnh của riêng bạn.">Hình nền</PanelTitle>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={cn(tile, 'flex flex-col items-center justify-center gap-1 bg-cream text-[11px] font-bold text-ink-soft ring-transparent hover:bg-brand-tint')}
        >
          <ImagePlus className="h-4 w-4" aria-hidden />
          Tải ảnh lên
        </button>
        {hasUpload && (
          <button type="button" onClick={() => update({ background: { kind: 'upload' } })} className={cn(tile, 'bg-ink text-[11px] font-bold text-white', bg.kind === 'upload' ? 'ring-brand-deep' : 'ring-transparent')}>
            Ảnh của bạn
          </button>
        )}
        {prefs.video && (
          <button
            type="button"
            onClick={() => update({ background: { kind: 'youtube' } })}
            className={cn(tile, bg.kind === 'youtube' ? 'ring-brand-deep' : 'ring-transparent')}
            aria-label="Dùng video YouTube làm nền"
          >
            <img src={prefs.video.thumbnail || thumbOf(prefs.video.id)} alt="" className="h-full w-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-black/50 py-0.5 text-[10px] font-bold text-white">Video</span>
          </button>
        )}
        {GHIBLI_IMAGES.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => update({ background: { kind: 'image', id: g.id } })}
            className={cn(tile, bg.kind === 'image' && bg.id === g.id ? 'ring-brand-deep' : 'ring-transparent hover:ring-line-strong')}
            title={g.label}
            aria-label={`Hình nền: ${g.label}`}
          >
            <img src={ghibliThumb(g.id)} alt="" loading="lazy" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = '';
        }}
      />
      {hasUpload && (
        <button type="button" onClick={onRemoveUpload} className="mt-2 text-xs font-extrabold text-danger-fg hover:underline">
          Xóa ảnh đã tải lên
        </button>
      )}
      <label className="mt-4 block text-xs font-bold text-ink-soft">
        Độ tối của nền
        <input type="range" min={0} max={0.7} step={0.05} value={prefs.dim} onChange={(e) => update({ dim: Number(e.target.value) })} className={cn(range, 'mt-1.5')} />
      </label>
    </div>
  );
}

// ───────────────────────── Hẹn giờ ─────────────────────────
const PHASES: PomodoroPhase[] = ['focus', 'short', 'long'];
const BELLS: Array<{ id: BellSound; label: string }> = [
  { id: 'bells', label: 'Chuông' },
  { id: 'beep', label: 'Bíp' },
  { id: 'none', label: 'Tắt' },
];

export function TimerPanel() {
  const p = usePomodoro();
  const s = p.settings;
  const toast = useToast();
  const canNotify = typeof window !== 'undefined' && 'Notification' in window;

  async function toggleNotify(on: boolean) {
    if (!on) return p.updateSettings({ notify: false });
    if (!canNotify) return toast('Trình duyệt không hỗ trợ thông báo.', 'error');
    const perm = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (perm !== 'granted') return toast('Bạn đã chặn thông báo cho trang này trong trình duyệt.', 'error');
    p.updateSettings({ notify: true });
  }

  return (
    <div>
      <PanelTitle hint={p.status === 'idle' ? 'Thay đổi áp dụng ngay.' : 'Thay đổi áp dụng từ phiên kế tiếp.'}>Hẹn giờ</PanelTitle>
      <div className="grid grid-cols-3 gap-2">
        {PHASES.map((ph) => (
          <label key={ph} className="text-xs font-bold text-ink-soft">
            {PHASE_LABEL[ph]}
            <div className="mt-1 flex items-center rounded-lg border border-line bg-white pr-2 focus-within:border-[#8fb874]">
              <input
                type="number"
                min={1}
                max={ph === 'focus' ? 180 : 90}
                value={s.minutes[ph]}
                onChange={(e) => p.updateSettings({ minutes: { ...s.minutes, [ph]: Number(e.target.value) } })}
                className="w-full rounded-lg bg-transparent px-2 py-1.5 text-sm font-bold text-ink outline-none"
              />
              <span className="text-[11px] text-ink-mute">phút</span>
            </div>
          </label>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {[
          [25, 5, 15],
          [50, 10, 20],
          [90, 15, 30],
        ].map(([f, sh, l]) => (
          <button
            key={f}
            type="button"
            onClick={() => p.updateSettings({ minutes: { focus: f, short: sh, long: l } })}
            className={cn('rounded-full px-2.5 py-1 text-[11px] font-extrabold', s.minutes.focus === f && s.minutes.short === sh ? 'bg-brand text-ink' : 'bg-cream text-ink-soft hover:bg-brand-tint')}
          >
            {f}/{sh}/{l}
          </button>
        ))}
      </div>

      <label className="mt-4 flex items-center justify-between gap-3 text-xs font-bold text-ink-soft">
        Nghỉ dài sau mỗi
        <select value={s.longEvery} onChange={(e) => p.updateSettings({ longEvery: Number(e.target.value) })} className="input-base h-8 w-28 py-0">
          {[2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n} phiên
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 text-xs font-bold text-ink-soft">
        Tự động chạy pha tiếp theo
        <input type="checkbox" className="h-4 w-4 accent-[#4f8a4b]" checked={s.autoStart} onChange={(e) => p.updateSettings({ autoStart: e.target.checked })} />
      </label>

      <div className="mt-4 rounded-xl bg-cream p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-ink">
          <Bell className="h-3.5 w-3.5" aria-hidden /> Chuông khi hết giờ
        </p>
        <div className="flex gap-1.5">
          {BELLS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                p.updateSettings({ bell: b.id });
                p.testBell(b.id);
              }}
              className={cn('flex-1 rounded-lg py-1.5 text-xs font-extrabold', s.bell === b.id ? 'bg-brand text-ink' : 'bg-white text-ink-soft hover:bg-brand-tint')}
              aria-pressed={s.bell === b.id}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Volume2 className="h-3.5 w-3.5 shrink-0 text-ink-mute" aria-hidden />
          <input type="range" min={0.1} max={1} step={0.05} value={s.bellVolume} onChange={(e) => p.updateSettings({ bellVolume: Number(e.target.value) })} className={range} aria-label="Âm lượng chuông" />
          <button type="button" onClick={() => p.testBell()} className="shrink-0 text-[11px] font-extrabold text-brand-deep hover:underline">
            Nghe thử
          </button>
        </div>
        {canNotify && (
          <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 text-xs font-bold text-ink-soft">
            Hiện thông báo trên màn hình
            <input type="checkbox" className="h-4 w-4 accent-[#4f8a4b]" checked={s.notify} onChange={(e) => void toggleNotify(e.target.checked)} />
          </label>
        )}
      </div>
    </div>
  );
}
