import { Smartphone } from 'lucide-react';
import { Navigate, Outlet, createBrowserRouter } from 'react-router';
import { useAuth } from './auth/AuthContext';
import { AppShell } from './components/AppShell';
import { LogoMark } from './components/Logo';
import { Empty, ErrorPanel } from './components/ui';
import { SignIn, SignUp } from './pages/Auth';
import { People } from './pages/People';
import { MemberReport, Reports } from './pages/Reports';
import { Roles } from './pages/Roles';
import { Settings } from './pages/Settings';
import { TaskForm } from './pages/TaskForm';
import { Tasks } from './pages/Tasks';
import { Today } from './pages/Today';

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="full-screen-state">{children}</div>;
}

function RequireManager() {
  const { me, loading, error, retry, signOut } = useAuth();
  if (loading)
    return (
      <FullScreen>
        <div style={{ display: 'grid', justifyItems: 'center', gap: 12 }}>
          <LogoMark size={40} />
          <p role="status" className="sw-meta">
            Loading your workspace…
          </p>
        </div>
      </FullScreen>
    );
  if (error && !me)
    return (
      <FullScreen>
        <div style={{ width: 'min(32rem, 100%)' }}>
          <ErrorPanel title="Couldn't load your workspace" error={error} onRetry={retry} />
        </div>
      </FullScreen>
    );
  if (!me) return <Navigate to="/sign-in" replace />;
  if (me.user.access_level === 'employee')
    return (
      <FullScreen>
        <div className="sw-panel" style={{ width: 'min(30rem, 100%)', paddingTop: 32, textAlign: 'center' }}>
          <LogoMark size={48} />
          <Empty
            title={`Hi ${me.user.full_name.split(' ')[0]}, your tasks are in the app`}
            action={
              <button type="button" className="sw-btn" onClick={signOut}>
                Sign out
              </button>
            }
          >
            <Smartphone className="sw-icon" aria-hidden="true" /> This workspace is for the owner and supervisors. Open the
            Task Plus mobile app to see your checklist and report.
          </Empty>
        </div>
      </FullScreen>
    );
  return <Outlet />;
}

function PublicOnly() {
  const { me, loading } = useAuth();
  if (loading) return null;
  if (me) return <Navigate to="/" replace />;
  return <Outlet />;
}

export const router = createBrowserRouter([
  {
    element: <PublicOnly />,
    children: [
      { path: '/sign-in', element: <SignIn /> },
      { path: '/sign-up', element: <SignUp /> },
    ],
  },
  {
    element: <RequireManager />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, path: '/', element: <Today /> },
          { path: '/tasks', element: <Tasks /> },
          { path: '/tasks/new', element: <TaskForm /> },
          { path: '/tasks/:taskId', element: <TaskForm /> },
          { path: '/roles', element: <Roles /> },
          { path: '/people', element: <People /> },
          { path: '/reports', element: <Reports /> },
          { path: '/reports/:memberId', element: <MemberReport /> },
          { path: '/settings', element: <Settings /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
