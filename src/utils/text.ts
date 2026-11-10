/** Bỏ dấu tiếng Việt + hạ chữ thường để tìm kiếm "co so du lieu" vẫn ra "Cơ sở dữ liệu". */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}
