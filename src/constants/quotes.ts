/**
 * Câu nói truyền động lực tiếng Việt: tục ngữ, ca dao (dân gian) và một số câu tự viết cho ứng dụng.
 */
export const QUOTES: string[] = [
  'Có công mài sắt, có ngày nên kim.',
  'Học, học nữa, học mãi.',
  'Không có việc gì khó, chỉ sợ lòng không bền.',
  'Đi một ngày đàng, học một sàng khôn.',
  'Kiến tha lâu cũng đầy tổ.',
  'Muốn biết phải hỏi, muốn giỏi phải học.',
  'Nước chảy đá mòn.',
  'Thất bại là mẹ thành công.',
  'Ăn quả nhớ kẻ trồng cây – học hôm nay để mai này có quả ngọt.',
  'Một cây làm chẳng nên non, ba cây chụm lại nên hòn núi cao.',
  'Chậm mà chắc còn hơn nhanh mà hỏng.',
  'Mỗi phiên 25 phút hôm nay là một bước gần hơn tới mục tiêu.',
  'Bạn không cần làm hết mọi thứ – chỉ cần bắt đầu việc tiếp theo.',
  'Tập trung vào một việc thôi, phần còn lại để sau.',
  'Hôm nay cố gắng một chút, ngày mai nhẹ nhàng hơn nhiều.',
  'Deadline không đáng sợ bằng việc chưa bắt đầu.',
  'Nghỉ ngơi cũng là một phần của việc học.',
  'Chăm chỉ như những hạt mầm – lặng lẽ lớn lên mỗi ngày.',
  'Đừng so sánh mình với người khác, hãy so với chính mình hôm qua.',
  'Thành công là tổng của những nỗ lực nhỏ lặp lại mỗi ngày.',
  'Từng bước nhỏ vẫn là tiến về phía trước.',
  'Uống một ngụm nước, hít thở sâu, rồi tiếp tục nhé.',
  'Hãy tự hào vì bạn đang ngồi đây và học.',
  'Cơn mưa nào rồi cũng tạnh, bài khó nào rồi cũng xong.',
  'Gió đưa cây cải về trời – còn bạn đưa mình tới gần ước mơ.',
  'Tiến chậm không sao, miễn là đừng dừng lại.',
  'Hôm nay bạn đã làm tốt hơn bạn nghĩ đấy.',
  'Gieo thói quen, gặt tương lai.',
];

/** Câu của ngày – cố định trong một ngày, đổi sang ngày khác */
export function quoteOfDay(date = new Date()): string {
  const key = date.getFullYear() * 1000 + Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86_400_000);
  return QUOTES[key % QUOTES.length];
}
