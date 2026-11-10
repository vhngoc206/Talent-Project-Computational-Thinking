/**
 * Kết nối Firebase (Google): Authentication (email/mật khẩu + Google) và Firestore (lưu dữ liệu từng tài khoản).
 *
 * Cấu hình Firebase cho web là thông tin CÔNG KHAI (không phải mật khẩu) – quyền truy cập dữ liệu
 * được bảo vệ bằng Firestore Security Rules (file firestore.rules).
 * Thiếu cấu hình (ví dụ khi chạy test) => firebaseEnabled = false, ứng dụng chạy chế độ cục bộ không đăng nhập.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';

const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

export const firebaseEnabled = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (firebaseEnabled) {
  app = initializeApp(config);
  auth = getAuth(app);
  auth.languageCode = 'vi';
  // Bộ nhớ đệm offline: mất mạng vẫn xem/sửa được, có mạng lại thì tự đồng bộ
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
}

export function firebaseAuth(): Auth {
  if (!auth) throw new Error('Firebase chưa được cấu hình');
  return auth;
}

export function firestore(): Firestore {
  if (!db) throw new Error('Firebase chưa được cấu hình');
  return db;
}
