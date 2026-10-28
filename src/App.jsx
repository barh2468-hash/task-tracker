import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { envReady } from './services/supabase.js';
import { AuthProvider } from './features/auth/AuthContext.jsx';
import { MessageProvider } from './context/MessageContext.jsx';
import { NotificationsProvider } from './features/notifications/NotificationsContext.jsx';
import { ProjectsProvider } from './features/projects/ProjectsContext.jsx';
import { AttendanceProvider } from './features/attendance/AttendanceContext.jsx';
import { ChatProvider } from './features/chat/ChatContext.jsx';
import SetupPage from './routes/SetupPage.jsx';
import LoginPage, { LoadingScreen } from './routes/LoginPage.jsx';
import ForgotPasswordPage from './routes/ForgotPasswordPage.jsx';
import ResetPasswordPage from './routes/ResetPasswordPage.jsx';
import RequireAuth from './routes/RequireAuth.jsx';
import DashboardLayout from './routes/DashboardLayout.jsx';
import AccountingLayout from './routes/AccountingLayout.jsx';
import ProjectsPage from './routes/ProjectsPage.jsx';
import OverviewPage from './routes/OverviewPage.jsx';
import PwaBootstrap from './features/pwa/components/PwaBootstrap.jsx';
import OfflineSync from './features/offline/OfflineSync.jsx';
import { LanguageProvider } from './features/language/LanguageContext.jsx';
import { useAuth } from './features/auth/useAuth.js';

// Code-split the heavier, less-frequently-visited pages (Leaflet map, Excel/
// CSV-export-heavy reports) so the initial bundle stays close to the
// projects list that most sessions land on.
const TodayPage = lazy(() => import('./routes/TodayPage.jsx'));
const WorkPlanPage = lazy(() => import('./routes/WorkPlanPage.jsx'));
const LocalWorkPlanPreview = import.meta.env.DEV ? lazy(() => import('./features/work-planning/LocalWorkPlanPreview.jsx')) : null;
const LiveMapPage = lazy(() => import('./routes/LiveMapPage.jsx'));
const NewProjectPage = lazy(() => import('./routes/NewProjectPage.jsx'));
const ProjectStatusReportPage = lazy(() => import('./routes/ProjectStatusReportPage.jsx'));
const AssignmentsPage = lazy(() => import('./routes/AssignmentsPage.jsx'));
const TasksPage = lazy(() => import('./routes/TasksPage.jsx'));
const GprPage = lazy(() => import('./routes/GprPage.jsx'));
const LocalGprPreview = import.meta.env.DEV ? lazy(() => import('./features/gpr/LocalGprPreview.jsx')) : null;
const HistoryPage = lazy(() => import('./routes/HistoryPage.jsx'));
const NotificationsPage = lazy(() => import('./routes/NotificationsPage.jsx'));
const ExceptionsPage = lazy(() => import('./routes/ExceptionsPage.jsx'));
const WorkReportPage = lazy(() => import('./routes/WorkReportPage.jsx'));
const ChatPage = lazy(() => import('./routes/ChatPage.jsx'));
const AttendancePage = lazy(() => import('./routes/AttendancePage.jsx'));
const PersonalAttendancePage = lazy(() => import('./routes/PersonalAttendancePage.jsx'));
const PersonalNotesPage = lazy(() => import('./routes/PersonalNotesPage.jsx'));
const EquipmentPage = lazy(() => import('./routes/EquipmentPage.jsx'));
const VehicleRegisterPage = lazy(() => import('./routes/VehicleRegisterPage.jsx'));
const RecentStatusChangesPage = lazy(() => import('./routes/RecentStatusChangesPage.jsx'));
const AccountingYearEndPage = lazy(() => import('./routes/AccountingYearEndPage.jsx'));
const AccountingFuelPage = lazy(() => import('./routes/AccountingFuelPage.jsx'));
const AccountingTollsPage = lazy(() => import('./routes/AccountingTollsPage.jsx'));
const ManholeLayoutPage = lazy(() => import('./routes/ManholeLayoutPage.jsx'));
const VehiclesPage = lazy(() => import('./routes/VehiclesPage.jsx'));
const MyVehiclePage = lazy(() => import('./routes/MyVehiclePage.jsx'));
const VehicleDetailPage = lazy(() => import('./routes/VehicleDetailPage.jsx'));
const VehicleFinesPage = lazy(() => import('./routes/VehicleFinesPage.jsx'));

// The year-end table is for the main accounting role only; regular accounting gets fuel.
function RequireMainAccounting({ children }) {
  const { isAccountingMain } = useAuth();
  if (!isAccountingMain) return <Navigate to="/app/accounting/fuel" replace />;
  return children;
}

// Vehicle management belongs to the manager role.
function RequireVehicleAccess({ children }) {
  const { isManager } = useAuth();
  if (!isManager) return <Navigate to="/app" replace />;
  return children;
}
const UserManagementPage = lazy(() => import('./routes/UserManagementPage.jsx'));

function AppLanding() {
  const { isAccounting, isAccountingMain, isDrafter } = useAuth();
  if (isAccounting) return <Navigate to={isAccountingMain ? 'accounting/year-end' : 'accounting/fuel'} replace />;
  return <Navigate to={isDrafter ? 'projects' : 'attendance'} replace />;
}

function AppProviders({ children }) {
  return (
    <MessageProvider>
      <OfflineSync />
      <NotificationsProvider>
        <ChatProvider>
          <ProjectsProvider>
            <AttendanceProvider>{children}</AttendanceProvider>
          </ProjectsProvider>
        </ChatProvider>
      </NotificationsProvider>
    </MessageProvider>
  );
}

// Accounting has its own mini layout/routes — it doesn't need the dashboard's
// projects/attendance/chat/notifications providers.
function AppRoot() {
  const { isAccounting } = useAuth();
  if (isAccounting) return <AccountingLayout />;
  return (
    <AppProviders>
      <DashboardLayout />
    </AppProviders>
  );
}

export default function App() {
  if (import.meta.env.DEV && window.location.pathname === '/local/gpr') {
    return <LanguageProvider><Suspense fallback={<LoadingScreen />}><LocalGprPreview /></Suspense></LanguageProvider>;
  }
  // Preview only in the local Vite development server; the production auth flow is unchanged.
  if (import.meta.env.DEV && window.location.pathname === '/local/work-plan') {
    return <LanguageProvider><Suspense fallback={<LoadingScreen />}><LocalWorkPlanPreview /></Suspense></LanguageProvider>;
  }
  if (!envReady) return <SetupPage />;

  return (
    <LanguageProvider>
      <BrowserRouter>
        <PwaBootstrap />
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route element={<RequireAuth />}>
              <Route path="/app" element={<AppRoot />}>
                <Route index element={<AppLanding />} />
                <Route
                  path="attendance"
                  element={
                    <Suspense fallback={<LoadingScreen />}>
                      <AttendancePage />
                    </Suspense>
                  }
                />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="gpr" element={<Suspense fallback={<LoadingScreen />}><GprPage /></Suspense>} />
                <Route path="my-attendance" element={<Suspense fallback={<LoadingScreen />}><PersonalAttendancePage /></Suspense>} />
                <Route path="my-notes" element={<Suspense fallback={<LoadingScreen />}><PersonalNotesPage /></Suspense>} />
                <Route path="my-vehicle" element={<Suspense fallback={<LoadingScreen />}><MyVehiclePage /></Suspense>} />
                <Route path="overview" element={<OverviewPage />} />
                <Route path="work-plan" element={<Suspense fallback={<LoadingScreen />}><WorkPlanPage /></Suspense>} />
                <Route
                  path="manhole-layout"
                  element={
                    <Suspense fallback={<LoadingScreen />}>
                      <ManholeLayoutPage />
                    </Suspense>
                  }
                />
                <Route
                  path="today"
                  element={
                    <Suspense fallback={<LoadingScreen />}>
                      <TodayPage />
                    </Suspense>
                  }
                />
                <Route
                  path="map"
                  element={
                    <Suspense fallback={<LoadingScreen />}>
                      <LiveMapPage />
                    </Suspense>
                  }
                />
                <Route
                  path="projects/new"
                  element={
                    <Suspense fallback={<LoadingScreen />}>
                      <NewProjectPage />
                    </Suspense>
                  }
                />
                <Route
                  path="status-report"
                  element={
                    <Suspense fallback={<LoadingScreen />}>
                      <ProjectStatusReportPage />
                    </Suspense>
                  }
                />
                <Route
                  path="assignments"
                  element={
                    <Suspense fallback={<LoadingScreen />}>
                      <AssignmentsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="tasks"
                  element={
                    <Suspense fallback={<LoadingScreen />}>
                      <TasksPage />
                    </Suspense>
                  }
                />
                <Route
                  path="history"
                  element={
                    <Suspense fallback={<LoadingScreen />}>
                      <HistoryPage />
                    </Suspense>
                  }
                />
                <Route
                  path="notifications"
                  element={
                    <Suspense fallback={<LoadingScreen />}>
                      <NotificationsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="exceptions"
                  element={
                    <Suspense fallback={<LoadingScreen />}>
                      <ExceptionsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="chat"
                  element={
                    <Suspense fallback={<LoadingScreen />}>
                      <ChatPage />
                    </Suspense>
                  }
                />
                <Route
                  path="report"
                  element={
                    <Suspense fallback={<LoadingScreen />}>
                      <WorkReportPage />
                    </Suspense>
                  }
                />
                <Route
                  path="vehicle-register"
                  element={
                    <RequireVehicleAccess>
                    <Suspense fallback={<LoadingScreen />}>
                      <VehicleRegisterPage />
                    </Suspense>
                    </RequireVehicleAccess>
                  }
                />
                <Route
                  path="equipment"
                  element={
                    <Suspense fallback={<LoadingScreen />}>
                      <EquipmentPage />
                    </Suspense>
                  }
                />
                <Route
                  path="recent-status-changes"
                  element={
                    <Suspense fallback={<LoadingScreen />}>
                      <RecentStatusChangesPage />
                    </Suspense>
                  }
                />
                <Route
                  path="vehicles"
                  element={
                    <RequireVehicleAccess>
                      <Suspense fallback={<LoadingScreen />}>
                        <VehiclesPage />
                      </Suspense>
                    </RequireVehicleAccess>
                  }
                />
                <Route
                  path="vehicles/archive"
                  element={
                    <RequireVehicleAccess>
                      <Suspense fallback={<LoadingScreen />}>
                        <VehiclesPage archive />
                      </Suspense>
                    </RequireVehicleAccess>
                  }
                />
                <Route
                  path="vehicles/fines"
                  element={
                    <RequireVehicleAccess>
                      <Suspense fallback={<LoadingScreen />}>
                        <VehicleFinesPage />
                      </Suspense>
                    </RequireVehicleAccess>
                  }
                />
                <Route
                  path="vehicles/:vehicleId"
                  element={
                    <RequireVehicleAccess>
                      <Suspense fallback={<LoadingScreen />}>
                        <VehicleDetailPage />
                      </Suspense>
                    </RequireVehicleAccess>
                  }
                />
                <Route
                  path="accounting/year-end"
                  element={
                    <RequireMainAccounting>
                      <Suspense fallback={<LoadingScreen />}>
                        <AccountingYearEndPage />
                      </Suspense>
                    </RequireMainAccounting>
                  }
                />
                <Route
                  path="accounting/fuel"
                  element={
                    <Suspense fallback={<LoadingScreen />}>
                      <AccountingFuelPage />
                    </Suspense>
                  }
                />
                <Route
                  path="accounting/tolls"
                  element={
                    <Suspense fallback={<LoadingScreen />}>
                      <AccountingTollsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="users"
                  element={
                    <Suspense fallback={<LoadingScreen />}>
                      <UserManagementPage />
                    </Suspense>
                  }
                />
              </Route>
            </Route>
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </LanguageProvider>
  );
}
