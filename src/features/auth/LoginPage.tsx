/** Trang Đăng nhập / Đăng ký – email + mật khẩu hoặc tài khoản Google. */
import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { ghibliSrc, ghibliThumb } from '../../constants/ghibli';
import { quoteOfDay } from '../../constants/quotes';
import { cn } from '../../utils/cn';
import { authErrorMessage, useAuth } from './AuthContext';

type Mode = 'signin' | 'signup' | 'reset';

/** Logo "G" nhiều màu theo hướng dẫn thương hiệu nút "Đăng nhập bằng Google" */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

export function LoginPage() {
  const auth = useAuth()!;
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState<'form' | 'google' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function switchMode(m: Mode) {
    setMode(m);
    setError('');
    setNotice('');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    if (mode === 'signup') {
      if (!name.trim()) return setError('Hãy nhập tên của bạn.');
      if (password.length < 6) return setError('Mật khẩu cần ít nhất 6 ký tự.');
      if (password !== confirm) return setError('Mật khẩu nhập lại không khớp.');
    }
    setBusy('form');
    try {
      if (mode === 'signin') await auth.signIn(email, password);
      else if (mode === 'signup') await auth.signUp(name, email, password);
      else {
        await auth.resetPassword(email);
        setNotice('Đã gửi thư đặt lại mật khẩu. Hãy kiểm tra hộp thư (cả mục Spam).');
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function onGoogle() {
    setError('');
    setBusy('google');
    try {
      await auth.signInWithGoogle();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const title = mode === 'signin' ? 'Chào mừng trở lại' : mode === 'signup' ? 'Tạo tài khoản' : 'Quên mật khẩu';
  const field = 'input-base h-11 text-sm';

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-10">
      <img src={ghibliSrc('totoro041')} alt="" aria-hidden className="anim-ken-burns absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/10 to-black/45" />

      <main className="anim-pop-in relative w-full max-w-[400px] rounded-3xl bg-white/90 p-6 shadow-pop backdrop-blur-xl sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <img src={ghibliThumb('totoro024')} alt="" className="h-11 w-11 rounded-xl object-cover" style={{ objectPosition: '45% 35%' }} />
          <div>
            <p className="text-base font-black leading-tight">SmartStudy</p>
            <p className="text-xs font-semibold text-ink-mute">Kế hoạch học tập của riêng bạn</p>
          </div>
        </div>

        <h1 className="font-serif text-2xl font-bold">{title}</h1>
        <p className="mb-5 mt-1 text-sm text-ink-soft">
          {mode === 'signin' && 'Đăng nhập để xem nhiệm vụ, lịch và tiến độ của bạn.'}
          {mode === 'signup' && 'Dữ liệu của bạn được lưu riêng và dùng được trên mọi thiết bị.'}
          {mode === 'reset' && 'Nhập email, chúng tôi sẽ gửi đường link đặt lại mật khẩu.'}
        </p>

        {mode !== 'reset' && (
          <>
            <button
              type="button"
              onClick={() => void onGoogle()}
              disabled={busy !== null}
              className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-line-strong bg-white text-sm font-bold text-ink transition-colors hover:bg-cream disabled:opacity-60"
            >
              {busy === 'google' ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleLogo />}
              {mode === 'signup' ? 'Đăng ký bằng Google' : 'Đăng nhập bằng Google'}
            </button>
            <div className="my-4 flex items-center gap-3 text-xs font-semibold text-ink-mute">
              <span className="h-px flex-1 bg-line" /> hoặc dùng email <span className="h-px flex-1 bg-line" />
            </div>
          </>
        )}

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3" noValidate>
          {mode === 'signup' && (
            <label className="block">
              <span className="mb-1 block text-xs font-extrabold text-ink-soft">Tên của bạn</span>
              <input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoComplete="name" placeholder="Ví dụ: Ngọc" />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-extrabold text-ink-soft">Email</span>
            <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="ban@gmail.com" required />
          </label>
          {mode !== 'reset' && (
            <label className="block">
              <span className="mb-1 flex items-center justify-between text-xs font-extrabold text-ink-soft">
                Mật khẩu
                {mode === 'signin' && (
                  <button type="button" onClick={() => switchMode('reset')} className="font-bold text-brand-deep hover:underline">
                    Quên mật khẩu?
                  </button>
                )}
              </span>
              <span className="relative block">
                <input
                  className={cn(field, 'pr-10')}
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  placeholder={mode === 'signup' ? 'Ít nhất 6 ký tự' : ''}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-mute hover:bg-black/5"
                  aria-label={showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>
          )}
          {mode === 'signup' && (
            <label className="block">
              <span className="mb-1 block text-xs font-extrabold text-ink-soft">Nhập lại mật khẩu</span>
              <input className={field} type={showPass ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
            </label>
          )}

          {error && (
            <p className="rounded-lg bg-danger-bg px-3 py-2 text-xs font-semibold text-danger-fg" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-lg bg-safe-bg px-3 py-2 text-xs font-semibold text-safe-fg" role="status">
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={busy !== null}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-deep text-sm font-extrabold text-white transition-colors hover:bg-[#335c2f] disabled:opacity-60"
          >
            {busy === 'form' && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'signin' ? 'Đăng nhập' : mode === 'signup' ? 'Đăng ký' : 'Gửi link đặt lại mật khẩu'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-soft">
          {mode === 'signin' ? (
            <>
              Chưa có tài khoản?{' '}
              <button type="button" onClick={() => switchMode('signup')} className="font-extrabold text-brand-deep hover:underline">
                Đăng ký
              </button>
            </>
          ) : (
            <>
              Đã có tài khoản?{' '}
              <button type="button" onClick={() => switchMode('signin')} className="font-extrabold text-brand-deep hover:underline">
                Đăng nhập
              </button>
            </>
          )}
        </p>
      </main>

      <p className="absolute inset-x-0 bottom-4 px-4 text-center font-serif text-sm italic text-white/90 [text-shadow:0_2px_10px_rgb(0_0_0/0.5)]">“{quoteOfDay()}”</p>
    </div>
  );
}
