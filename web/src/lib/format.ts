import type { AccessLevel, Recurrence, TaskBrief, TaskSchedule } from '../api/types';

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  once: 'One time',
  daily: 'Every day',
  weekly: 'Once a week',
  specific_days: 'Specific days',
};

export const ACCESS_LABEL: Record<AccessLevel, string> = {
  owner: 'Owner',
  supervisor: 'Supervisor',
  employee: 'Employee',
};

/** Parse YYYY-MM-DD as a local calendar date (no timezone shift). */
export function parseDay(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(value: string, days: number): string {
  const date = parseDay(value);
  date.setDate(date.getDate() + days);
  return toDay(date);
}

const shortDate = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const longDate = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

export const formatShortDate = (value: string) => shortDate.format(parseDay(value));
export const formatLongDate = (value: string) => longDate.format(parseDay(value));
export const formatDayMonth = (value: string) => dayMonth.format(parseDay(value));

export function formatRange(start: string, end: string): string {
  return start === end ? formatDayMonth(start) : `${formatDayMonth(start)} – ${formatDayMonth(end)}`;
}

/** "09:00:00" → "09:00" */
export function formatTime(value: string | null): string {
  return value ? value.slice(0, 5) : '';
}

/** A timestamp shown in the organization's timezone. */
export function formatClock(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(iso));
}

export function formatStamp(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso));
}

export function windowLabel(task: Pick<TaskSchedule, 'start_time' | 'end_time'>): string {
  const start = formatTime(task.start_time);
  const end = formatTime(task.end_time);
  if (start && end) return `${start}–${end}`;
  if (start) return `From ${start}`;
  if (end) return `By ${end}`;
  return 'Any time';
}

export function daysLabel(days: number[] | null): string {
  const list = [...(days ?? [])].sort();
  const key = list.join(',');
  if (key === '0,1,2,3,4') return 'Weekdays';
  if (key === '5,6') return 'Weekends';
  if (list.length === 7) return 'Every day';
  return list.map((d) => WEEKDAYS[d]).join(', ');
}

export function repeatLabel(task: TaskSchedule): string {
  switch (task.recurrence) {
    case 'once':
      return task.due_date ? `One time, due ${formatShortDate(task.due_date)}` : 'One time';
    case 'daily':
      return 'Every day';
    case 'weekly':
      return 'Once a week';
    case 'specific_days':
      return daysLabel(task.days_of_week);
  }
}

export function scheduleLabel(task: TaskSchedule): string {
  const window = windowLabel(task);
  return window === 'Any time' ? repeatLabel(task) : `${repeatLabel(task)} · ${window}`;
}

export function assigneeLabel(task: Pick<TaskBrief, 'role' | 'assignee'>): string {
  if (task.role) return task.role.name;
  if (task.assignee) return task.assignee.full_name;
  return 'All employees';
}

export function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function timezones(): string[] {
  try {
    const list = Intl.supportedValuesOf('timeZone');
    return list.includes('UTC') ? list : ['UTC', ...list];
  } catch {
    return ['UTC', browserTimezone()];
  }
}

export type RangePreset = '7' | '14' | '30' | 'custom';

export function presetRange(preset: RangePreset, today: string): { start: string; end: string } {
  const days = preset === 'custom' ? 7 : Number(preset);
  return { start: addDays(today, -(days - 1)), end: today };
}
