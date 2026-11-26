import { ChartColumn, ClipboardList, ListChecks, Settings, Tags, Users, type LucideIcon } from 'lucide-react';
import type { AccessLevel } from '../api/types';

/** A live count shown beside a nav item. AppShell's useNavCounts() fills each one in. */
export type NavCount = 'overdue';

/** Words read after the number by screen readers, e.g. "Today, 9 overdue". */
export const COUNT_LABEL: Record<NavCount, string> = { overdue: 'overdue' };

export interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
  /** Only an exact path match counts as current (needed for "/"). */
  end?: boolean;
  /** Gets a slot in the phone tab bar (keep it to four); the rest go in the More sheet. */
  tab?: boolean;
  /** Who sees it. Omitted means everyone who can use the web app (owner and supervisors). */
  access?: AccessLevel[];
  count?: NavCount;
}

export interface NavGroup {
  /** Section heading. Omitted for the items at the very top. */
  label?: string;
  items: NavItem[];
}

/**
 * The web app's navigation in sidebar order. A page added here shows up in the
 * sidebar, the phone tab bar or More sheet, filtered by access level.
 */
export const NAV: NavGroup[] = [
  { items: [{ to: '/', label: 'Today', Icon: ListChecks, end: true, tab: true, count: 'overdue' }] },
  { label: 'Work', items: [{ to: '/tasks', label: 'Tasks', Icon: ClipboardList, tab: true }] },
  {
    label: 'Team',
    items: [
      { to: '/people', label: 'People', Icon: Users, tab: true },
      { to: '/roles', label: 'Roles', Icon: Tags },
    ],
  },
  { label: 'Insights', items: [{ to: '/reports', label: 'Reports', Icon: ChartColumn, tab: true }] },
];

/** Pinned to the bottom of the sidebar, above the account button. */
export const NAV_FOOTER: NavItem[] = [{ to: '/settings', label: 'Settings', Icon: Settings }];

export function canSee(item: NavItem, level: AccessLevel): boolean {
  return !item.access || item.access.includes(level);
}

export function visibleGroups(level: AccessLevel): NavGroup[] {
  return NAV.map((group) => ({ ...group, items: group.items.filter((item) => canSee(item, level)) })).filter(
    (group) => group.items.length > 0,
  );
}

export function isCurrent(pathname: string, item: Pick<NavItem, 'to' | 'end'>): boolean {
  if (item.end || item.to === '/') return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}
