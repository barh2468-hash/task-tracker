import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { envReady } from './services/supabase.js';
import { AuthProvider } from './features/auth/AuthContext.jsx';
import { MessageProvider } from './context/MessageContext.jsx';
import { NotificationsProvider } from './features/notifications/NotificationsContext.jsx';
import { ProjectsProvider } from './features/projects/ProjectsContext.jsx';
import { AttendanceProvider } from './features/attendance/AttendanceContext.jsx';
import SetupPage from './routes/SetupPage.jsx';
import LoginPage, { LoadingScreen } from './routes/LoginPage.jsx';
import RequireAuth from './routes/RequireAuth.jsx';
import DashboardLayout from './routes/DashboardLayout.jsx';
import ProjectsPage from './routes/ProjectsPage.jsx';
import PwaBootstrap from './features/pwa/components/PwaBootstrap.jsx';
import OfflineSync from './features/offline/OfflineSync.jsx';
import { LanguageProvider } from './features/language/LanguageContext.jsx';

// Code-split the heavier, less-frequently-visited pages (Leaflet map, Excel/
// CSV-export-heavy reports) so the initial bundle stays close to the
// projects list that most sessions land on.
const TodayPage = lazy(() => import('./routes/TodayPage.jsx'));
const LiveMapPage = lazy(() => import('./routes/LiveMapPage.jsx'));
const NewProjectPage = lazy(() => import('./routes/NewProjectPage.jsx'));
const ProjectStatusReportPage = lazy(() => import('./routes/ProjectStatusReportPage.jsx'));
const AssignmentsPage = lazy(() => import('./routes/AssignmentsPage.jsx'));
const TasksPage = lazy(() => import('./routes/TasksPage.jsx'));
const HistoryPage = lazy(() => import('./routes/HistoryPage.jsx'));
const NotificationsPage = lazy(() => import('./routes/NotificationsPage.jsx'));
const ExceptionsPage = lazy(() => import('./routes/ExceptionsPage.jsx'));
const WorkReportPage = lazy(() => import('./routes/WorkReportPage.jsx'));

function AppProviders({ children }) {
  return (
    <MessageProvider>
      <OfflineSync />
      <NotificationsProvider>
        <ProjectsProvider>
          <AttendanceProvider>{children}</AttendanceProvider>
        </ProjectsProvider>
      </NotificationsProvider>
    </MessageProvider>
  );
}

export default function App() {
  if (!envReady) return <SetupPage />;

  return (
    <LanguageProvider>
      <BrowserRouter>
        <PwaBootstrap />
        <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route
              path="/app"
              element={
                <AppProviders>
                  <DashboardLayout />
                </AppProviders>
              }
            >
              <Route index element={<Navigate to="projects" replace />} />
              <Route path="projects" element={<ProjectsPage />} />
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
                path="report"
                element={
                  <Suspense fallback={<LoadingScreen />}>
                    <WorkReportPage />
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
