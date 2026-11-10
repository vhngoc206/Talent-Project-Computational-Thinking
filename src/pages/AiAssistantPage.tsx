import { AdvisorChat } from '../features/ai-assistant/AdvisorChat';
import { AiModeBanner } from '../features/ai-assistant/AiStatus';
import { StudyPlannerPanel } from '../features/ai-assistant/StudyPlannerPanel';
import { TaskAnalyzerPanel } from '../features/ai-assistant/TaskAnalyzerPanel';

/** Trang AI Study Assistant: Task Analyzer · Study Planner · Study Advisor (chat). */
export function AiAssistantPage() {
  return (
    <div className="space-y-4">
      <AiModeBanner />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-7">
          <TaskAnalyzerPanel />
          <StudyPlannerPanel />
        </div>
        <div className="xl:col-span-5">
          <AdvisorChat />
        </div>
      </div>
    </div>
  );
}
