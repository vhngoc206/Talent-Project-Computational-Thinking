/**
 * Tài khoản quản trị: chỉ email này (đã xác minh) mới mở được trang Quản trị.
 * Quyền đọc dữ liệu thống kê được kiểm tra lại ở phía Firebase trong firestore.rules – sửa email ở cả hai nơi.
 */
export const ADMIN_EMAIL = 'vohongngoc16102006@gmail.com';

export const isAdminEmail = (email: string | null | undefined) => (email ?? '').trim().toLowerCase() === ADMIN_EMAIL;
