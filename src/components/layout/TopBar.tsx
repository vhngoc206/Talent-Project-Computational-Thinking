import { useEffect, useRef, useState } from 'react';
import { DatabaseBackup, LogOut, Menu, PencilLine, ShieldCheck, Timer, Trash2 } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { Button } from '../ui/Button';
import { ConfirmDialog, Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { Field } from '../ui/FormControls';
import { usePomodoro } from '../../features/pomodoro/PomodoroContext';
import { formatClock, PHASE_LABEL } from '../../features/pomodoro/pomodoroLogic';
import { routeHref, type RouteId } from '../../hooks/useHashRoute';
import { useNow } from '../../hooks/useNow';
import { useAppState } from '../../state/AppStateContext';
import { formatLongDate } from '../../utils/date';

export function TopBar({ route, title, icon, onOpenMenu }: { route: RouteId; title: string; icon: string; onOpenMenu: () => void }) {
  const { data, actions } = useAppState();
  const pomodoro = usePomodoro();
  const toast = useToast();
  const now = useNow(60_000);
  const auth = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [confirmReset, setConfirmReset] = useState<'sample' | 'clear' | null>(null);

  // Bấm ra ngoài thì đóng menu tài khoản
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const menuItems = [
    {
      icon: PencilLine,
      label: 'Đổi tên hiển thị',
      onClick: () => {
        setNameDraft(data.userName === 'bạn' ? '' : data.userName);
        setEditingName(true);
      },
    },
    ...(auth?.isAdmin ? [{ icon: ShieldCheck, label: 'Quản trị', onClick: () => (window.location.hash = routeHref('admin')) }] : []),
    { icon: DatabaseBackup, label: 'Nạp dữ liệu mẫu', onClick: () => setConfirmReset('sample') },
    { icon: Trash2, label: 'Xóa toàn bộ dữ liệu', onClick: () => setConfirmReset('clear') },
    ...(auth?.user ? [{ icon: LogOut, label: 'Đăng xuất', onClick: () => void auth.signOut() }] : []),
  ];
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const initial = (data.userName.trim()[0] ?? 'B').toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between gap-3 border-b border-transparent bg-paper/85 px-3 backdrop-blur-md sm:px-4">
        <div className="flex min-w-0 items-center gap-1.5 text-sm">
          <button type="button" onClick={onOpenMenu} className="rounded-md p-1.5 text-ink-soft hover:bg-black/5 lg:hidden" aria-label="Mở menu">
            <Menu className="h-4 w-4" />
          </button>
          <span className="hidden text-ink-mute sm:inline">SmartStudy</span>
          <span className="hidden text-ink-mute sm:inline">/</span>
          <span className="truncate font-semibold text-ink">
            <span aria-hidden>{icon}</span> {title}
          </span>
          <span className="ml-2 hidden truncate text-xs text-ink-mute md:inline">{formatLongDate(now)}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {pomodoro.status !== 'idle' && route !== 'focus' && (
            <a
              href={routeHref('focus')}
              className="flex items-center gap-1.5 rounded-full bg-brand-tint px-3 py-1 text-xs font-extrabold text-brand-deep"
              title="Pomodoro đang chạy – mở trang Focus"
            >
              <Timer className="h-3.5 w-3.5" aria-hidden />
              <span className="tabular-nums">{formatClock(pomodoro.remainingSeconds)}</span>
              <span className="hidden sm:inline">· {PHASE_LABEL[pomodoro.phase]}</span>
            </a>
          )}

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2.5 text-sm font-bold hover:bg-black/5"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              {auth?.user?.photoURL ? (
                <img src={auth.user.photoURL} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-xs font-black text-ink">{initial}</span>
              )}
              <span className="hidden max-w-[120px] truncate sm:inline">{data.userName}</span>
            </button>
            {menuOpen && (
              <div role="menu" className="anim-pop-in absolute right-0 top-10 z-40 w-64 rounded-xl bg-white p-1.5 shadow-pop">
                {auth?.user && (
                  <div className="mb-1 border-b border-line px-3 pb-2 pt-1.5">
                    <p className="truncate text-sm font-extrabold">{data.userName}</p>
                    <p className="truncate text-xs text-ink-mute">{auth.user.email}</p>
                  </div>
                )}
                {menuItems.map(({ icon: Icon, label, onClick }) => (
                  <button
                    key={label}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onClick();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink-soft hover:bg-cream hover:text-ink"
                  >
                    <Icon className="h-4 w-4" aria-hidden /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {confirmReset && (
        <ConfirmDialog
          title={confirmReset === 'sample' ? 'Nạp dữ liệu mẫu?' : 'Xóa toàn bộ dữ liệu?'}
          confirmLabel={confirmReset === 'sample' ? 'Nạp dữ liệu mẫu' : 'Xóa hết'}
          onCancel={() => setConfirmReset(null)}
          onConfirm={() => {
            if (confirmReset === 'sample') actions.resetDemoData();
            else actions.clearAllData();
            setConfirmReset(null);
            toast(confirmReset === 'sample' ? 'Đã nạp dữ liệu mẫu.' : 'Đã xóa toàn bộ dữ liệu.');
          }}
          message={
            confirmReset === 'sample'
              ? 'Môn học, nhiệm vụ, sự kiện và giờ học hiện có sẽ được thay bằng dữ liệu mẫu để bạn xem thử. Không thể hoàn tác.'
              : 'Toàn bộ môn học, nhiệm vụ, sự kiện và giờ học sẽ bị xóa. Không thể hoàn tác.'
          }
        />
      )}

      {editingName && (
        <Modal
          title="Tên hiển thị"
          size="sm"
          onClose={() => setEditingName(false)}
          footer={
            <>
              <Button onClick={() => setEditingName(false)}>Hủy</Button>
              <Button
                variant="primary"
                onClick={() => {
                  actions.setUserName(nameDraft);
                  setEditingName(false);
                }}
              >
                Lưu
              </Button>
            </>
          }
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              actions.setUserName(nameDraft);
              setEditingName(false);
            }}
          >
            <Field label="Bạn muốn được gọi là gì?" hint="Tên này dùng trong lời chào trên trang Tổng quan.">
              {({ id, describedBy }) => (
                <input id={id} aria-describedby={describedBy} autoFocus className="input-base" value={nameDraft} maxLength={30} onChange={(e) => setNameDraft(e.target.value)} placeholder="Ví dụ: Ngọc" />
              )}
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}
