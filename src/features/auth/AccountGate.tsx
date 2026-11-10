/**
 * Cổng tài khoản: chưa đăng nhập => trang Đăng nhập; đã đăng nhập => tải dữ liệu của RIÊNG tài khoản đó
 * rồi mới hiện ứng dụng. Đổi tài khoản thì toàn bộ state được tạo lại (key = uid) nên không lẫn dữ liệu.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { createEmptyData } from '../../services/seedData';
import { loadUserData, recordVisit, saveUserData } from '../../services/cloudStore';
import { AppStateProvider } from '../../state/AppStateContext';
import type { AppData } from '../../types';
import { displayNameOf, useAuth } from './AuthContext';
import { LoginPage } from './LoginPage';

function Splash({ text }: { text: string }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-paper text-ink-soft">
      <Loader2 className="h-6 w-6 animate-spin text-brand-deep" aria-hidden />
      <p className="text-sm font-semibold">{text}</p>
    </div>
  );
}

export function AccountGate({ children }: { children: ReactNode }) {
  const auth = useAuth()!;
  const user = auth.user;
  const [state, setState] = useState<{ uid: string; data: AppData } | { uid: string; error: true } | null>(null);

  useEffect(() => {
    if (!user) {
      setState(null);
      return;
    }
    let cancelled = false;
    loadUserData(user.uid)
      .then((data) => {
        if (!cancelled) setState({ uid: user.uid, data: data ?? createEmptyData(displayNameOf(user)) });
      })
      .catch(() => {
        if (!cancelled) setState({ uid: user.uid, error: true });
      });
    // Ghi một lượt truy cập cho mỗi phiên trình duyệt (mở tab mới / mở lại web)
    const key = `smartstudy.visit.${user.uid}`;
    try {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        void recordVisit(user, displayNameOf(user)).catch(() => sessionStorage.removeItem(key));
      }
    } catch {
      /* sessionStorage bị chặn – bỏ qua thống kê */
    }
    return () => {
      cancelled = true;
    };
  }, [user]);

  const uid = user?.uid;
  const persist = useCallback((data: AppData) => saveUserData(uid!, data), [uid]);

  if (user === undefined) return <Splash text="Đang mở SmartStudy…" />;
  if (user === null) return <LoginPage />;
  if (!state || state.uid !== user.uid) return <Splash text="Đang tải dữ liệu của bạn…" />;
  if ('error' in state)
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-paper px-6 text-center">
        <p className="text-sm font-semibold text-ink-soft">Không tải được dữ liệu. Kiểm tra kết nối mạng rồi thử lại.</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-brand px-4 py-2 text-sm font-extrabold text-ink">
            Thử lại
          </button>
          <button type="button" onClick={() => void auth.signOut()} className="rounded-lg border border-line px-4 py-2 text-sm font-extrabold text-ink">
            Đăng xuất
          </button>
        </div>
      </div>
    );

  return (
    <AppStateProvider key={user.uid} initialData={state.data} persist={persist}>
      {children}
    </AppStateProvider>
  );
}
