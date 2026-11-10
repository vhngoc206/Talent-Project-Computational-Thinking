/**
 * Ảnh phim "Hàng xóm của tôi là Totoro" (1988) do Studio Ghibli phát hành chính thức tại
 * https://www.ghibli.jp/works/totoro/ với lời cho phép: "常識の範囲でご自由にお使いください"
 * (hãy sử dụng tự do trong phạm vi thông thường). Ảnh được tải về, nén lại và đặt trong public/ghibli/.
 * KHÔNG có ảnh nào do AI tạo ra.
 */

export interface GhibliImage {
  id: string;
  /** Mô tả ngắn tiếng Việt (dùng cho alt + bộ chọn hình nền) */
  label: string;
  /** Vị trí lấy nét khi cắt ảnh làm ảnh bìa (CSS object-position) */
  focus: string;
}

export const GHIBLI_IMAGES: GhibliImage[] = [
  { id: 'totoro029', label: 'Trạm xe buýt dưới mưa', focus: 'center 40%' },
  { id: 'totoro041', label: 'Cánh đồng chiều hè', focus: 'center 45%' },
  { id: 'totoro001', label: 'Ngôi nhà mới', focus: 'center 56%' },
  { id: 'totoro019', label: 'Đường hầm trong rừng', focus: 'center 66%' },
  { id: 'totoro034', label: 'Đêm trên cành cây', focus: 'center 30%' },
  { id: 'totoro044', label: 'Mèo xe buýt', focus: 'center 45%' },
  { id: 'totoro025', label: 'Bụi cây bí mật', focus: 'center 50%' },
  { id: 'totoro021', label: 'Mei trên bãi cỏ', focus: 'center 50%' },
  { id: 'totoro047', label: 'Hoàng hôn bên tượng Jizo', focus: 'center 60%' },
  { id: 'totoro011', label: 'Giếng nước sau nhà', focus: 'center 42%' },
  { id: 'totoro012', label: 'Đạp xe về quê', focus: 'center 35%' },
  { id: 'totoro018', label: 'Mei đi khám phá', focus: 'center 55%' },
  { id: 'totoro026', label: 'Bàn làm việc của bố', focus: 'center 25%' },
  { id: 'totoro038', label: 'Bữa trưa ngoài vườn', focus: 'center 48%' },
  { id: 'totoro031', label: 'Mèo xe buýt đến đón', focus: 'center 45%' },
  { id: 'totoro024', label: 'Mei ngủ trên bụng Totoro', focus: 'center 40%' },
];

const base = import.meta.env.BASE_URL;
export const ghibliSrc = (id: string) => `${base}ghibli/${id}.jpg`;
export const ghibliThumb = (id: string) => `${base}ghibli/thumb/${id}.jpg`;
export const ghibliImage = (id: string) => GHIBLI_IMAGES.find((g) => g.id === id) ?? GHIBLI_IMAGES[0];
