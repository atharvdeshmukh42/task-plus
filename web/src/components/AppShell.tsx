import { ChartColumn, ClipboardList, Ellipsis, ListChecks, LogOut, Settings, Tags, Users } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { LogoMark } from './Logo';
import { Dialog } from './ui';
import { useAuth, useMeRequired } from '../auth/AuthContext';
import { ACCESS_LABEL } from '../lib/format';

/** `primary` items get a slot in the phone tab bar; the rest go in its More sheet. */
const NAV = [
  { to: '/', label: 'Today', Icon: ListChecks, end: true, primary: true },
  { to: '/tasks', label: 'Tasks', Icon: ClipboardList, primary: true },
  { to: '/roles', label: 'Roles', Icon: Tags, primary: false },
  { to: '/people', label: 'People', Icon: Users, primary: true },
  { to: '/reports', label: 'Reports', Icon: ChartColumn, primary: true },
  { to: '/settings', label: 'Settings', Icon: Settings, primary: false },
];
const SECONDARY = NAV.filter((item) => !item.primary);

export function AppShell() {
  const { user, organization } = useMeRequired();
  const { signOut } = useAuth();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const inMore = SECONDARY.some(({ to }) => pathname === to || pathname.startsWith(`${to}/`));

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

      {/* Phone widths only (CSS hides it elsewhere). */}
      <nav className="tab-bar" aria-label="Main">
        {NAV.filter((item) => item.primary).map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="tab-bar__item">
            <span className="tab-bar__icon">
              <Icon aria-hidden="true" />
            </span>
            {label}
          </NavLink>
        ))}
        <button
          type="button"
          className={`tab-bar__item${inMore ? ' is-current' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(true)}
        >
          <span className="tab-bar__icon">
            <Ellipsis aria-hidden="true" />
          </span>
          More
        </button>
      </nav>
      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="More" sheet>
        <nav className="sheet-nav" aria-label="More">
          {SECONDARY.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} onClick={() => setMoreOpen(false)}>
              <Icon aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sheet-account">
          <div>
            <strong>{user.full_name}</strong>
            <span className="sw-meta">
              {ACCESS_LABEL[user.access_level]} · {organization.name}
            </span>
          </div>
          <button type="button" className="sw-btn" onClick={signOut}>
            <LogOut className="sw-icon" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </Dialog>
    </>
  );
}
