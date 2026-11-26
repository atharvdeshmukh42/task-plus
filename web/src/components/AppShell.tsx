import { ChartColumn, ChevronDown, ClipboardList, Ellipsis, ListChecks, LogOut, Settings, Tags, Users } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { LogoMark } from './Logo';
import { Dialog } from './ui';
import { useAuth, useMeRequired } from '../auth/AuthContext';
import { ACCESS_LABEL } from '../lib/format';

/** Top-bar pages. `tab` items also get a slot in the phone tab bar; the rest go in its More sheet. */
const NAV = [
  { to: '/', label: 'Today', Icon: ListChecks, end: true, tab: true },
  { to: '/tasks', label: 'Tasks', Icon: ClipboardList, tab: true },
  { to: '/people', label: 'People', Icon: Users, tab: true },
  { to: '/roles', label: 'Roles', Icon: Tags, tab: false },
  { to: '/reports', label: 'Reports', Icon: ChartColumn, tab: true },
];
/** Organization and password settings live in the account menu (desktop) or the More sheet (phone). */
const SETTINGS = { to: '/settings', label: 'Settings', Icon: Settings };
const MORE = [...NAV.filter((item) => !item.tab), SETTINGS];

const isAt = (pathname: string, to: string) => pathname === to || pathname.startsWith(`${to}/`);

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return letters.map((w) => w[0]).join('').toLocaleUpperCase() || '?';
}

function AccountMenu() {
  const { user, organization } = useMeRequired();
  const { signOut } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    // focusin (not blur) so a click on a menu item in Safari, which doesn't focus buttons, doesn't close it first.
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="account" ref={root}>
      <button
        ref={button}
        type="button"
        className={`account__button${isAt(pathname, SETTINGS.to) ? ' is-current' : ''}`}
        aria-label={`${user.full_name}, account menu`}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="avatar" aria-hidden="true">
          {initials(user.full_name)}
        </span>
        <span className="account__name">
          <strong>{user.full_name}</strong>
          <span className="sw-meta">{ACCESS_LABEL[user.access_level]}</span>
        </span>
        <ChevronDown className="account__chevron" aria-hidden="true" />
      </button>
      {open && (
        <div id={menuId} className="account-menu">
          <div className="account-menu__who">
            <span className="avatar avatar--large" aria-hidden="true">
              {initials(user.full_name)}
            </span>
            <div>
              <strong>{user.full_name}</strong>
              <span className="sw-meta">{user.email ?? user.phone}</span>
              <span className="sw-meta">
                {ACCESS_LABEL[user.access_level]} · {organization.name}
              </span>
            </div>
          </div>
          <NavLink to={SETTINGS.to} className="account-menu__item" onClick={() => setOpen(false)}>
            <SETTINGS.Icon aria-hidden="true" />
            {SETTINGS.label}
          </NavLink>
          <button type="button" className="account-menu__item" onClick={signOut}>
            <LogOut aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const { user, organization } = useMeRequired();
  const { signOut } = useAuth();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const inMore = MORE.some(({ to }) => isAt(pathname, to));

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
              <NavLink key={to} to={to} end={end} className="nav-tab">
                <Icon aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>
          <AccountMenu />
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>

      {/* Phone widths only (CSS hides it elsewhere). */}
      <nav className="tab-bar" aria-label="Main">
        {NAV.filter((item) => item.tab).map(({ to, label, Icon, end }) => (
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
          {MORE.map(({ to, label, Icon }) => (
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
