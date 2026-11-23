import type { Occurrence, TaskSchedule } from './types';

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function parseDay(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addDays(value: string, days: number): string {
  const date = parseDay(value);
  date.setDate(date.getDate() + days);
  return toDay(date);
}

const shortDate = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const longDate = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

export const formatShortDate = (value: string) => shortDate.format(parseDay(value));
export const formatLongDate = (value: string) => longDate.format(parseDay(value));
export const formatDayMonth = (value: string) => dayMonth.format(parseDay(value));

export function formatClock(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(iso));
}

const time = (value: string | null) => (value ? value.slice(0, 5) : '');

export function windowLabel(task: Pick<TaskSchedule, 'start_time' | 'end_time'>): string | null {
  const start = time(task.start_time);
  const end = time(task.end_time);
  if (start && end) return `${start}–${end}`;
  if (start) return `From ${start}`;
  if (end) return `By ${end}`;
  return null;
}

export function repeatLabel(task: TaskSchedule): string {
  switch (task.recurrence) {
    case 'once':
      return task.due_date ? `Due ${formatShortDate(task.due_date)}` : 'One time';
    case 'daily':
      return 'Every day';
    case 'weekly':
      return 'Once a week';
    case 'specific_days': {
      const days = [...(task.days_of_week ?? [])].sort();
      if (days.join(',') === '0,1,2,3,4') return 'Weekdays';
      if (days.join(',') === '5,6') return 'Weekends';
      return days.map((d) => WEEKDAYS[d]).join(', ');
    }
  }
}

export function occurrenceContext(o: Occurrence): string {
  if (o.scope === 'week' && o.due_date) return `This week · by ${formatShortDate(o.due_date)}`;
  return repeatLabel(o.task);
}

export function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}
