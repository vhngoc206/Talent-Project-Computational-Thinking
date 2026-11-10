/**
 * Lưu dữ liệu học tập của từng tài khoản trên Firestore + ghi nhận lượt truy cập.
 *
 * Cấu trúc:
 *   userData/{uid}  { json, version, updatedAt }   – toàn bộ AppData dạng JSON (đọc lại qua sanitizeAppData)
 *   users/{uid}     { email, name, photoURL, provider, createdAt, lastSeenAt, visitCount }
 *   visits/{auto}   { uid, email, name, at, device }
 * Ai được đọc/ghi gì do firestore.rules quyết định (mỗi người chỉ thấy dữ liệu của mình; thống kê chỉ admin đọc được).
 */
import type { User } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getDocs, increment, limit, orderBy, query, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import type { AppData } from '../types';
import { firestore } from './firebase';
import { sanitizeAppData } from './storageService';

const DATA_VERSION = 1;

/** Dữ liệu của tài khoản; null = tài khoản mới chưa có dữ liệu */
export async function loadUserData(uid: string): Promise<AppData | null> {
  const snap = await getDoc(doc(firestore(), 'userData', uid));
  if (!snap.exists()) return null;
  const json = snap.get('json');
  if (typeof json !== 'string') return null;
  try {
    return sanitizeAppData(JSON.parse(json))?.data ?? null;
  } catch {
    return null;
  }
}

export async function saveUserData(uid: string, data: AppData): Promise<void> {
  await setDoc(doc(firestore(), 'userData', uid), {
    json: JSON.stringify({ version: DATA_VERSION, ...data }),
    version: DATA_VERSION,
    updatedAt: serverTimestamp(),
  });
}

/** "Chrome · Windows" – đủ để admin biết thiết bị, không lưu chi tiết hơn */
export function describeDevice(ua: string): string {
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Trình duyệt khác';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Khác';
  return `${browser} · ${os}`;
}

const providerOf = (user: User) => (user.providerData.some((p) => p.providerId === 'google.com') ? 'google' : 'password');

/** Gọi mỗi lần mở web (một lần cho mỗi phiên trình duyệt): cập nhật hồ sơ + thêm một lượt truy cập. */
export async function recordVisit(user: User, name: string): Promise<void> {
  const db = firestore();
  const profileRef = doc(db, 'users', user.uid);
  const existing = await getDoc(profileRef);
  await setDoc(
    profileRef,
    {
      email: user.email ?? '',
      name,
      photoURL: user.photoURL ?? '',
      provider: providerOf(user),
      lastSeenAt: serverTimestamp(),
      visitCount: increment(1),
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );
  await addDoc(collection(db, 'visits'), {
    uid: user.uid,
    email: user.email ?? '',
    name,
    at: serverTimestamp(),
    device: describeDevice(navigator.userAgent),
  });
}

// ---------- Dữ liệu cho trang Quản trị ----------
export interface VisitRow {
  id: string;
  uid: string;
  email: string;
  name: string;
  at: Date;
  device: string;
}
export interface UserRow {
  uid: string;
  email: string;
  name: string;
  photoURL: string;
  provider: string;
  createdAt: Date | null;
  lastSeenAt: Date | null;
  visitCount: number;
}

const toDate = (v: unknown) => (v instanceof Timestamp ? v.toDate() : null);

export async function fetchVisits(max = 1000): Promise<VisitRow[]> {
  const snap = await getDocs(query(collection(firestore(), 'visits'), orderBy('at', 'desc'), limit(max)));
  return snap.docs.map((d) => ({
    id: d.id,
    uid: String(d.get('uid') ?? ''),
    email: String(d.get('email') ?? ''),
    name: String(d.get('name') ?? ''),
    at: toDate(d.get('at')) ?? new Date(),
    device: String(d.get('device') ?? ''),
  }));
}

export async function fetchUsers(): Promise<UserRow[]> {
  const snap = await getDocs(collection(firestore(), 'users'));
  return snap.docs.map((d) => ({
    uid: d.id,
    email: String(d.get('email') ?? ''),
    name: String(d.get('name') ?? ''),
    photoURL: String(d.get('photoURL') ?? ''),
    provider: String(d.get('provider') ?? ''),
    createdAt: toDate(d.get('createdAt')),
    lastSeenAt: toDate(d.get('lastSeenAt')),
    visitCount: Number(d.get('visitCount') ?? 0),
  }));
}
