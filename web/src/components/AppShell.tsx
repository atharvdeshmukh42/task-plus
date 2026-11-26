import { ChevronsUpDown, Ellipsis, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Fragment, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { LogoMark } from './Logo';
import { Dialog } from './ui';
import { useBoard } from '../api/hooks';
import { useAuth, useMeRequired } from '../auth/AuthContext';
import { ACCESS_LABEL } from '../lib/format';
import { COUNT_LABEL, NAV_FOOTER, canSee, isCurrent, visibleGroups, type NavCount, type NavItem } from '../lib/nav';

/* ---------- Sidebar width ---------- */

/** Below this width the sidebar is always the icon rail; above it, each viewer chooses. */
const NARROW_QUERY = '(max-width: 64rem)';
const RAIL_KEY = 'taskplus.sidebar';

function subscribeNarrow(onChange: () => void) {
  const query = window.matchMedia(NARROW_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
const isNarrow = () => window.matchMedia(NARROW_QUERY).matches;

function readRailPreference(): boolean {
  try {
    return localStorage.getItem(RAIL_KEY) === 'rail';
  } catch {
    return false;
  }
}

function saveRailPreference(rail: boolean) {
  try {
    localStorage.setItem(RAIL_KEY, rail ? 'rail' : 'full');
  } catch {
    // Storage can be unavailable (private mode); the choice then lasts for this visit only.
  }
}

/* ---------- Live counts ---------- */

function useNavCounts(): Partial<Record<NavCount, number>> {
  // Same query as the Today page's default view, so the two share one cached, polled request.
  const board = useBoard(null, null);
  const overdue = board.data?.members.reduce(
    (sum, { occurrences }) => sum + occurrences.filter((o) => o.status === 'overdue').length,
    0,
  );
  return { overdue };
}

function CountBadge({ kind, value, className }: { kind: NavCount; value?: number; className: string }) {
  if (!value) return null;
  return (
    <span className={className}>
      <span className="sw-visually-hidden">, </span>
      {value}
      <span className="sw-visually-hidden"> {COUNT_LABEL[kind]}</span>
    </span>
  );
}

function SideLink({ item, count }: { item: NavItem; count?: number }) {
  const { to, label, Icon, end } = item;
  return (
    <NavLink to={to} end={end} className="nav-link">
      <Icon className="nav-link__icon" aria-hidden="true" />
      <span className="nav-link__label">{label}</span>
      {item.count && <CountBadge kind={item.count} value={count} className="nav-badge" />}
    </NavLink>
  );
}

/* ---------- Account ---------- */

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return letters.map((w) => w[0]).join('').toLocaleUpperCase() || '?';
}

function AccountMenu() {
  const { user, organization } = useMeRequired();
  const { signOut } = useAuth();
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
        className="account__button"
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
        <ChevronsUpDown className="account__chevron" aria-hidden="true" />
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
          <button type="button" className="account-menu__item" onClick={signOut}>
            <LogOut aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Shell ---------- */

export function AppShell() {
  const { user, organization } = useMeRequired();
  const { signOut } = useAuth();
  const { pathname } = useLocation();
  const counts = useNavCounts();
  const narrow = useSyncExternalStore(subscribeNarrow, isNarrow);
  const [collapsed, setCollapsed] = useState(readRailPreference);
  const [moreOpen, setMoreOpen] = useState(false);
  const rail = narrow || collapsed;

  const groups = visibleGroups(user.access_level);
  const footer = NAV_FOOTER.filter((item) => canSee(item, user.access_level));
  const tabs = groups.flatMap((group) => group.items).filter((item) => item.tab);
  const moreGroups = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.tab) }))
    .filter((group) => group.items.length > 0);
  const inMore = [...moreGroups.flatMap((group) => group.items), ...footer].some((item) => isCurrent(pathname, item));

  function toggleRail() {
    setCollapsed(!collapsed);
    saveRailPreference(!collapsed);
  }

  const brand = (
    <Link to="/" className="brand" aria-label={`${organization.name}, Today`}>
      <LogoMark size={32} className="brand-logo" />
      <span className="workspace-name">{organization.name}</span>
    </Link>
  );

  return (
    <div className={`shell${rail ? ' shell--rail' : ''}`}>
      <a href="#main" className="sw-visually-hidden">
        Skip to content
      </a>

      <aside className="sidebar">
        <div className="sidebar__brand">{brand}</div>
        <nav className="sidebar__nav" aria-label="Main">
          {groups.map((group, index) => {
            const headingId = `nav-group-${index}`;
            return (
              <div key={group.label ?? index} className="nav-group">
                {group.label && (
                  <p id={headingId} className="nav-group__label">
                    {group.label}
                  </p>
                )}
                <ul aria-labelledby={group.label ? headingId : undefined}>
                  {group.items.map((item) => (
                    <li key={item.to}>
                      <SideLink item={item} count={item.count && counts[item.count]} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
        <div className="sidebar__footer">
          <ul>
            {footer.map((item) => (
              <li key={item.to}>
                <SideLink item={item} />
              </li>
            ))}
          </ul>
          <AccountMenu />
          {!narrow && (
            <button type="button" className="nav-link sidebar__toggle" onClick={toggleRail}>
              {rail ? (
                <PanelLeftOpen className="nav-link__icon" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="nav-link__icon" aria-hidden="true" />
              )}
              <span className="nav-link__label">{rail ? 'Expand sidebar' : 'Collapse sidebar'}</span>
            </button>
          )}
        </div>
      </aside>

      {/* Phone widths only (CSS hides the sidebar there and shows this bar and the tab bar). */}
      <header className="phone-bar">{brand}</header>

      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>

      <nav className="tab-bar" aria-label="Main">
        {tabs.map(({ to, label, Icon, end, count }) => {
          const value = count && counts[count];
          return (
            <NavLink key={to} to={to} end={end} className="tab-bar__item">
              <span className="tab-bar__icon">
                <Icon aria-hidden="true" />
                {/* The number sits on the icon; screen readers hear it after the label instead. */}
                {count && value ? (
                  <span className="tab-bar__badge" aria-hidden="true">
                    {value}
                  </span>
                ) : null}
              </span>
              {label}
              {count && value ? <span className="sw-visually-hidden">{`, ${value} ${COUNT_LABEL[count]}`}</span> : null}
            </NavLink>
          );
        })}
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
          {moreGroups.map((group, index) => (
            <Fragment key={group.label ?? index}>
              {group.label && <p className="sheet-nav__label">{group.label}</p>}
              {group.items.map(({ to, label, Icon }) => (
                <NavLink key={to} to={to} onClick={() => setMoreOpen(false)}>
                  <Icon aria-hidden="true" />
                  {label}
                </NavLink>
              ))}
            </Fragment>
          ))}
          {footer.length > 0 && <hr className="sheet-nav__rule" />}
          {footer.map(({ to, label, Icon }) => (
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
    </div>
  );
}
