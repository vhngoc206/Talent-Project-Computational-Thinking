import { AppShell } from './components/layout/AppShell';
import { ToastProvider } from './components/ui/Toast';
import { AmbientProvider } from './features/focus/AmbientContext';
import { PomodoroProvider } from './features/pomodoro/PomodoroContext';
import { useHashRoute, type RouteId } from './hooks/useHashRoute';
import { AiAssistantPage } from './pages/AiAssistantPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { CalendarPage } from './pages/CalendarPage';
import { DashboardPage } from './pages/DashboardPage';
import { FocusPage } from './pages/FocusPage';
import { SchedulerPage } from './pages/SchedulerPage';
import { SubjectsPage } from './pages/SubjectsPage';
import { TasksPage } from './pages/TasksPage';
import { AccountGate } from './features/auth/AccountGate';
import { AutoScheduler } from './features/scheduler/AutoScheduler';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { AdminPage } from './pages/AdminPage';
import { firebaseEnabled } from './services/firebase';
import { AppStateProvider } from './state/AppStateContext';

function renderPage(route: Exclude<RouteId, 'focus'>) {
  switch (route) {
    case 'dashboard':
      return <DashboardPage />;
    case 'subjects':
      return <SubjectsPage />;
    case 'tasks':
      return <TasksPage />;
    case 'calendar':
      return <CalendarPage />;
    case 'scheduler':
      return <SchedulerPage />;
    case 'ai':
      return <AiAssistantPage />;
    case 'analytics':
      return <AnalyticsPage />;
    case 'admin':
      return <AdminRoute />;
  }
}

/** Trang Quản trị chỉ mở được với tài khoản admin */
function AdminRoute() {
  const auth = useAuth();
  if (!auth?.isAdmin) return <p className="text-sm text-ink-soft">Bạn không có quyền xem trang này.</p>;
  return <AdminPage />;
}

function Screens() {
  const route = useHashRoute();
  return (
    <PomodoroProvider>
      <AmbientProvider>
        <AutoScheduler />
        {/* Focus là trang toàn màn hình riêng, không có sidebar */}
        {route === 'focus' ? <FocusPage /> : <AppShell route={route}>{renderPage(route)}</AppShell>}
      </AmbientProvider>
    </PomodoroProvider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      {firebaseEnabled ? (
        // Có Firebase: bắt buộc đăng nhập, mỗi tài khoản một bộ dữ liệu riêng
        <AuthProvider>
          <AccountGate>
            <Screens />
          </AccountGate>
        </AuthProvider>
      ) : (
        // Chưa cấu hình Firebase: chạy cục bộ trên trình duyệt như trước
        <AppStateProvider>
          <Screens />
        </AppStateProvider>
      )}
    </ToastProvider>
  );
}
