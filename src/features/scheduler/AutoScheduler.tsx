/**
 * Chạy ngầm (không vẽ gì): kiểm tra mỗi khi dữ liệu đổi và mỗi phút một lần,
 * cần thì tự xếp lại lịch học (xem rescheduleReason) và báo cho người dùng khi dời phiên bị lỡ.
 * Đồng thời nhắc trước deadline 1 tiếng (thông báo nổi + thông báo của hệ điều hành nếu được phép).
 */
import { useEffect, useRef } from 'react';
import { useToast } from '../../components/ui/Toast';
import { useNow } from '../../hooks/useNow';
import { useAppState } from '../../state/AppStateContext';
import { alertKey, dueSoon, formatMinutesLeft } from '../tasks/deadlineAlerts';
import { missedSessions, rescheduleReason } from './autoSchedule';

const ALERTED_KEY = 'smartstudy.v1.deadlineAlerts';

function readAlerted(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(ALERTED_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

export function AutoScheduler() {
  const { data, actions } = useAppState();
  const toast = useToast();
  const now = useNow(60_000);
  const running = useRef(false);
  /** Lần cuối tự dời phiên bị lỡ – chặn việc dời lặp lại liên tục */
  const lastMissedRun = useRef(0);

  // Tự xếp lại lịch
  useEffect(() => {
    if (running.current) return;
    const reason = rescheduleReason(data, new Date());
    if (!reason) return;
    // Dời phiên bị lỡ tối đa 1 lần mỗi phút (thay đổi dữ liệu thì vẫn xếp lại ngay)
    if (reason === 'missed' && Date.now() - lastMissedRun.current < 55_000) return;
    running.current = true;
    const missed = data.schedule ? missedSessions(data.schedule.sessions, new Date()).length : 0;
    actions.generateSchedule();
    if (reason === 'missed') {
      lastMissedRun.current = Date.now();
      if (missed > 0) toast(`Đã dời ${missed} phiên học bị lỡ sang thời gian rảnh tiếp theo.`, 'info');
    }
    // Cho state cập nhật xong rồi mới kiểm tra lại
    window.setTimeout(() => (running.current = false), 0);
  }, [data, now, actions, toast]);

  // Nhắc trước deadline 1 tiếng (mỗi nhiệm vụ chỉ nhắc một lần cho mỗi deadline)
  useEffect(() => {
    const soon = dueSoon(data.tasks, now);
    if (soon.length === 0) return;
    const alerted = readAlerted();
    let changed = false;
    for (const { task, minutesLeft } of soon) {
      const key = alertKey(task);
      if (alerted.has(key)) continue;
      alerted.add(key);
      changed = true;
      toast(`⏰ Sắp tới deadline: "${task.title}" còn ${formatMinutesLeft(minutesLeft)}!`, 'error');
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Sắp tới deadline', { body: `${task.title} – còn ${formatMinutesLeft(minutesLeft)}`, icon: '/icon-192.png', tag: key });
        }
      } catch {
        /* trình duyệt chặn thông báo */
      }
    }
    if (changed) {
      try {
        localStorage.setItem(ALERTED_KEY, JSON.stringify([...alerted].slice(-200)));
      } catch {
        /* bỏ qua */
      }
    }
  }, [data.tasks, now, toast]);

  return null;
}
