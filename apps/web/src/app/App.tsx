import { Component, lazy, useEffect } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { Toaster } from 'sonner';
import { useUi } from './store';
import { Protected } from './Layout';
import { AuthPage } from '../features/auth/AuthPage';
import { Dashboard } from '../features/board/Dashboard';
import { Rooms } from '../features/rooms/Rooms';
import { Empty } from '../shared/ui/primitives';

const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
});
const Statistics = lazy(() =>
  import('../features/statistics/Statistics').then((module) => ({ default: module.Statistics })),
);
const Profile = lazy(() =>
  import('../features/profile/Profile').then((module) => ({ default: module.Profile })),
);
const Admin = lazy(() =>
  import('../features/admin/Admin').then((module) => ({ default: module.Admin })),
);
const CaseShell = lazy(() =>
  import('../features/case-module/CaseShell').then((m) => ({ default: m.CaseShell })),
);
const CaseDashboard = lazy(() =>
  import('../features/case-module/CaseDashboard').then((m) => ({ default: m.CaseDashboard })),
);
const CaseWorkspacePage = lazy(() =>
  import('../features/case-module/CaseWorkspace').then((m) => ({ default: m.CaseWorkspacePage })),
);
const CaseAdmin = lazy(() =>
  import('../features/case-module/CaseAdmin').then((m) => ({ default: m.CaseAdmin })),
);
const CaseAudit = lazy(() =>
  import('../features/case-module/CaseAdmin').then((m) => ({ default: m.CaseAudit })),
);
function RouteScroll() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? (
      <div className="fatal-error">
        <h1>Ish maydonini qayta ochamiz</h1>
        <p>Kutilmagan xato yuz berdi. Ma’lumotlaringiz saqlangan.</p>
        <button className="button button--primary" onClick={() => window.location.reload()}>
          Sahifani yangilash
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export function App() {
  const reduced = useUi((state) => state.reducedMotion);
  return (
    <ErrorBoundary>
      <QueryClientProvider client={client}>
        <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>
          <BrowserRouter>
            <RouteScroll />
            <a className="skip-link" href="#main-content">
              Asosiy mazmunga o‘tish
            </a>
            <Routes>
              <Route path="/login" element={<AuthPage />} />
              <Route path="/register" element={<AuthPage register />} />
              <Route element={<Protected />}>
                <Route path="/board" element={<Dashboard />} />
                <Route path="/investigation-room" element={<Rooms room="investigation" />} />
                <Route path="/control-room" element={<Rooms room="control" />} />
                <Route path="/defense-room" element={<Rooms room="defense" />} />
                <Route path="/judgment-hall" element={<Rooms room="judgment" />} />
                <Route path="/statistics" element={<Statistics />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/case-files" element={<CaseShell />}>
                  <Route index element={<CaseDashboard />} />
                  <Route path="admin" element={<CaseAdmin />} />
                  <Route path="audit" element={<CaseAudit />} />
                  <Route path=":id" element={<CaseWorkspacePage />} />
                </Route>
                <Route path="/" element={<Navigate to="/board" replace />} />
                <Route
                  path="*"
                  element={
                    <Empty
                      title="Bu sahifa topilmadi"
                      action={
                        <Link className="button button--primary" to="/board">
                          Tergov doskasiga qaytish
                        </Link>
                      }
                    >
                      Kerakli xonani tergov doskasidan tanlang.
                    </Empty>
                  }
                />
              </Route>
            </Routes>
          </BrowserRouter>
          <Toaster
            position="bottom-right"
            mobileOffset={{ bottom: 96, left: 16, right: 16, top: 16 }}
            duration={2200}

            closeButton
            toastOptions={{ className: 'app-toast' }}
          />
        </MotionConfig>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
