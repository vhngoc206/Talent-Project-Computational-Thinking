import { useMemo } from 'react';
import { CalendarClock, Wand2 } from 'lucide-react';
import { computeScheduleSignature } from '../algorithms/greedyScheduler';
import { EmptyState } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useToast } from '../components/ui/Toast';
import { usePomodoro } from '../features/pomodoro/PomodoroContext';
import { FocusCard } from '../features/dashboard/FocusCard';
import { routeHref } from '../hooks/useHashRoute';
import { AvailabilityForm } from '../features/scheduler/AvailabilityForm';
import { ScheduleSummary } from '../features/scheduler/ScheduleSummary';
import { ScheduleView } from '../features/scheduler/ScheduleView';
import { useNow } from '../hooks/useNow';
import { useAppState } from '../state/AppStateContext';
import type { Availability, StudySchedule } from '../types';

/** Trang Lịch học: thiết lập thời gian rảnh → Greedy Scheduler → lịch theo ngày, đánh dấu đã học. */
export function SchedulerPage() {
  const { data, actions } = useAppState();
  const pomodoro = usePomodoro();
  const toast = useToast();
  const now = useNow(60_000);

  const pendingCount = data.tasks.filter((t) => t.status !== 'completed').length;
  const currentSignature = useMemo(() => computeScheduleSignature(data.tasks, data.availability, data.events), [data.tasks, data.availability, data.events]);
  const stale = data.schedule !== null && data.schedule.inputSignature !== currentSignature;

  function reportResult(s: StudySchedule) {
    if (s.unscheduled.length > 0) toast(`Đã tạo ${s.sessions.length} phiên học – ${s.unscheduled.length} nhiệm vụ chưa đủ thời gian.`, 'info');
    else toast(`Đã tạo lịch với ${s.sessions.length} phiên học.`);
  }

  const handleGenerate = () => reportResult(actions.generateSchedule());

  function handleSaveAvailability(a: Availability, andGenerate: boolean) {
    actions.setAvailability(a);
    if (andGenerate) {
      // Truyền thẳng thời gian rảnh mới vì state chỉ cập nhật ở lần render sau
      reportResult(actions.generateSchedule(a));
    } else {
      toast('Đã lưu thời gian rảnh.');
    }
  }

  function handleStudyNow(taskId: string) {
    pomodoro.setTaskId(taskId);
    window.location.hash = routeHref('focus');
    toast('Đã chọn nhiệm vụ trong Focus – bấm Bắt đầu để học.', 'info');
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="space-y-4 xl:col-span-4">
        <AvailabilityForm value={data.availability} onSave={handleSaveAvailability} />
        <FocusCard />
      </div>

      <div className="space-y-4 xl:col-span-8">
        {data.schedule ? (
          <>
            <ScheduleSummary
              schedule={data.schedule}
              tasks={data.tasks}
              stale={stale}
              onRegenerate={handleGenerate}
              onClear={() => {
                actions.clearSchedule();
                toast('Đã xóa lịch học (giờ học đã ghi nhận vẫn được giữ).', 'info');
              }}
            />
            <ScheduleView
              schedule={data.schedule}
              tasks={data.tasks}
              subjects={data.subjects}
              now={now}
              onToggle={(id, completed) => {
                actions.toggleScheduleSession(id, completed);
                toast(completed ? 'Đã ghi nhận phiên học vào tiến độ.' : 'Đã bỏ đánh dấu phiên học.', completed ? 'success' : 'info');
              }}
              onStudyNow={handleStudyNow}
            />
          </>
        ) : (
          <Card>
            <EmptyState
              icon={<CalendarClock className="h-6 w-6" />}
              title="Chưa có lịch học"
              text={
                pendingCount === 0
                  ? 'Bạn không còn nhiệm vụ nào cần làm.'
                  : `Có ${pendingCount} nhiệm vụ chưa xong. Ứng dụng sẽ xếp việc quan trọng nhất vào giờ rảnh sớm nhất, chia thành các phiên nhỏ và luôn xong trước deadline.`
              }
              action={
                <Button variant="primary" icon={<Wand2 className="h-4 w-4" />} onClick={handleGenerate} disabled={pendingCount === 0}>
                  Tạo lịch học tự động
                </Button>
              }
            />
          </Card>
        )}
      </div>
    </div>
  );
}
