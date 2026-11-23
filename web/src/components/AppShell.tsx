import { ChartColumn, ClipboardList, ListChecks, LogOut, Settings, Tags, Users } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { LogoMark } from './Logo';
import { useAuth, useMeRequired } from '../auth/AuthContext';
import { ACCESS_LABEL } from '../lib/format';

const NAV = [
  { to: '/', label: 'Today', Icon: ListChecks, end: true },
  { to: '/tasks', label: 'Tasks', Icon: ClipboardList },
  { to: '/roles', label: 'Roles', Icon: Tags },
  { to: '/people', label: 'People', Icon: Users },
  { to: '/reports', label: 'Reports', Icon: ChartColumn },
  { to: '/settings', label: 'Settings', Icon: Settings },
];

export function AppShell() {
  const { user, organization } = useMeRequired();
  const { signOut } = useAuth();
  return (
    <>
      <a href="#main" className="sw-visually-hidden">
        Skip to content
      </a>
      <header className="desk-bar">
        <div className="desk-bar__inner">
          <NavLink to="/" className="brand" aria-label={`${organization.name}, Today`}>
            <LogoMark size={32} className="brand-logo" />
            <span className="workspace-name">{organization.name}</span>
          </NavLink>
          <nav className="main-nav" aria-label="Main">
            {NAV.map(({ to, label, Icon, end }) => (
              <NavLink key={to} to={to} end={end} className="sw-btn sw-btn--quiet">
                <Icon aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="account">
            <div className="account__name">
              <strong>{user.full_name}</strong>
              <span className="sw-meta">{ACCESS_LABEL[user.access_level]}</span>
            </div>
            <button type="button" className="sw-btn" onClick={signOut}>
              <LogOut className="sw-icon" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
    </>
  );
}
