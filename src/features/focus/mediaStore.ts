/**
 * Lưu ảnh nền người dùng tự tải lên bằng IndexedDB (LocalStorage chỉ ~5MB, không hợp để chứa ảnh).
 * Chỉ lưu MỘT ảnh – tải ảnh mới sẽ thay ảnh cũ.
 */
const DB_NAME = 'smartstudy-media';
const STORE = 'files';
const BG_KEY = 'focus-background';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export const saveBackground = (file: Blob) => run<IDBValidKey>('readwrite', (s) => s.put(file, BG_KEY));
export const loadBackground = () => run<Blob | undefined>('readonly', (s) => s.get(BG_KEY)).catch(() => undefined);
export const clearBackground = () => run<undefined>('readwrite', (s) => s.delete(BG_KEY)).catch(() => undefined);
