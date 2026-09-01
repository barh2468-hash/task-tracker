import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { envReady } from './services/supabase.js';
import { AuthProvider } from './features/auth/AuthContext.jsx';
import { MessageProvider } from './context/MessageContext.jsx';
import SetupPage from './routes/SetupPage.jsx';
import LoginPage from './routes/LoginPage.jsx';
import RequireAuth from './routes/RequireAuth.jsx';
import AuthenticatedPlaceholder from './routes/AuthenticatedPlaceholder.jsx';

export default function App() {
  if (!envReady) return <SetupPage />;

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route
              path="/app/*"
              element={
                <MessageProvider>
                  <AuthenticatedPlaceholder />
                </MessageProvider>
              }
            />
          </Route>
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
