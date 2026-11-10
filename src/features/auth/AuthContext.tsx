/**
 * Đăng nhập bằng Firebase Authentication: email + mật khẩu, hoặc tài khoản Google.
 * Mật khẩu do Firebase lưu (đã băm) – ứng dụng không bao giờ thấy hay lưu mật khẩu.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { isAdminEmail } from '../../constants/admin';
import { firebaseAuth } from '../../services/firebase';

interface AuthValue {
  /** undefined = đang kiểm tra phiên đăng nhập */
  user: User | null | undefined;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/** Tên người dùng vừa nhập khi đăng ký (Firebase báo đăng nhập trước khi kịp lưu tên vào hồ sơ) */
let pendingSignupName = '';
export const displayNameOf = (user: User) => user.displayName || pendingSignupName || user.email?.split('@')[0] || 'bạn';

/** Đổi mã lỗi của Firebase thành câu tiếng Việt dễ hiểu */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-email': 'Email không hợp lệ.',
    'auth/missing-password': 'Hãy nhập mật khẩu.',
    'auth/weak-password': 'Mật khẩu cần ít nhất 6 ký tự.',
    'auth/email-already-in-use': 'Email này đã có tài khoản – hãy đăng nhập.',
    'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
    'auth/wrong-password': 'Email hoặc mật khẩu không đúng.',
    'auth/user-not-found': 'Email hoặc mật khẩu không đúng.',
    'auth/too-many-requests': 'Bạn thử quá nhiều lần. Đợi vài phút rồi thử lại.',
    'auth/network-request-failed': 'Không có kết nối mạng.',
    'auth/popup-closed-by-user': 'Bạn đã đóng cửa sổ đăng nhập Google.',
    'auth/cancelled-popup-request': 'Bạn đã đóng cửa sổ đăng nhập Google.',
    'auth/account-exists-with-different-credential': 'Email này đã đăng ký bằng mật khẩu – hãy đăng nhập bằng email.',
    'auth/unauthorized-domain': 'Trang web này chưa được phép đăng nhập Google. Liên hệ quản trị viên.',
    'auth/operation-not-allowed': 'Cách đăng nhập này chưa được bật. Liên hệ quản trị viên.',
  };
  return map[code] ?? 'Có lỗi xảy ra, thử lại nhé.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => onAuthStateChanged(firebaseAuth(), (u) => setUser(u)), []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(firebaseAuth(), email.trim(), password);
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    pendingSignupName = name.trim();
    const cred = await createUserWithEmailAndPassword(firebaseAuth(), email.trim(), password);
    if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() }).catch(() => undefined);
    // Gửi thư xác minh email (cần xác minh để dùng quyền quản trị)
    await sendEmailVerification(cred.user).catch(() => undefined);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(firebaseAuth(), provider);
    } catch (err) {
      // Trình duyệt chặn cửa sổ bật lên (hay gặp trên điện thoại) => chuyển hẳn sang trang Google
      if ((err as { code?: string }).code === 'auth/popup-blocked') await signInWithRedirect(firebaseAuth(), provider);
      else throw err;
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(firebaseAuth(), email.trim());
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(firebaseAuth());
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      // Admin = đúng email quản trị VÀ email đã được xác minh (Google luôn xác minh sẵn)
      isAdmin: !!user && user.emailVerified && isAdminEmail(user.email),
      signIn,
      signUp,
      signInWithGoogle,
      resetPassword,
      signOut,
    }),
    [user, signIn, signUp, signInWithGoogle, resetPassword, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue | null {
  return useContext(AuthContext);
}
