import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useBoard, useRoles } from '../api/hooks';
import type { Occurrence, Status } from '../api/types';
import { StatTiles } from '../components/reports';
import { Empty, ErrorPanel, LoadingNote, SkeletonRows, StatusBadge } from '../components/ui';
import { addDays, formatClock, formatLongDate, formatShortDate, repeatLabel, windowLabel } from '../lib/format';

type Filter = 'all' | 'open' | 'done' | 'late' | 'missed';

const FILTERS: { value: Filter; label: string; matches: (s: Status) => boolean }[] = [
  { value: 'all', label: 'All', matches: () => true },
  { value: 'open', label: 'Open', matches: (s) => s === 'pending' || s === 'overdue' || s === 'upcoming' },
  { value: 'done', label: 'Done', matches: (s) => s === 'done' },
  { value: 'late', label: 'Late', matches: (s) => s === 'late' },
  { value: 'missed', label: 'Missed', matches: (s) => s === 'missed' },
];

function occurrenceContext(o: Occurrence): string {
  if (o.scope === 'week' && o.due_date) return `Once this week · by ${formatShortDate(o.due_date)}`;
  return repeatLabel(o.task);
}

export function Today() {
  const [day, setDay] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const board = useBoard(day, roleId);
  const roles = useRoles();

  const rows = useMemo(
    () => (board.data?.members ?? []).flatMap(({ member, occurrences }) => occurrences.map((o) => ({ member, o }))),
    [board.data],
  );
  const needle = query.trim().toLocaleLowerCase();
  const searched = rows.filter(
    ({ member, o }) => !needle || `${member.full_name} ${o.task.title}`.toLocaleLowerCase().includes(needle),
  );
  const active = FILTERS.find((f) => f.value === filter)!;
  const shown = searched.filter(({ o }) => active.matches(o.status));

  const current = board.data?.date ?? day;
  const today = board.data?.today;
  const isToday = current !== null && current === today;
  const shiftDay = (delta: number) => current && setDay(addDays(current, delta));
  const clearFilters = () => {
    setFilter('all');
    setQuery('');
    setRoleId(null);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="sw-page-title">{isToday || !current ? 'Today' : formatShortDate(current)}</h1>
          <p>
            {current ? formatLongDate(current) : 'Loading…'}
            {board.data && ` · ${board.data.timezone.replace(/_/g, ' ')}`}
          </p>
        </div>
        <div className="page-head__actions">
          <div className="day-nav" role="group" aria-label="Choose day">
            <button type="button" className="sw-btn icon-btn" aria-label="Previous day" onClick={() => shiftDay(-1)} disabled={!current}>
              <ChevronLeft aria-hidden="true" />
            </button>
            <label>
              <span className="sw-visually-hidden">Date</span>
              <input
                className="sw-input"
                type="date"
                value={current ?? ''}
                onChange={(e) => e.target.value && setDay(e.target.value)}
              />
            </label>
            <button type="button" className="sw-btn icon-btn" aria-label="Next day" onClick={() => shiftDay(1)} disabled={!current}>
              <ChevronRight aria-hidden="true" />
            </button>
            {!isToday && current && (
              <button type="button" className="sw-btn sw-btn--quiet" onClick={() => setDay(null)}>
                Back to today
              </button>
            )}
          </div>
          <Link to="/tasks/new" className="sw-btn sw-btn--primary">
            <Plus className="sw-icon" aria-hidden="true" />
            New task
          </Link>
        </div>
      </div>

      {board.isError && <ErrorPanel title="Couldn't load the day's tasks" error={board.error} onRetry={() => board.refetch()} />}
      {board.data && <StatTiles summary={board.data.summary} />}

      <section className="sw-panel" aria-label="Team checklist">
        <div className="toolbar">
          <div className="filters" role="group" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                className="sw-btn sw-btn--quiet filter"
                aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}
              >
                {f.label} <span className="count">{searched.filter(({ o }) => f.matches(o.status)).length}</span>
              </button>
            ))}
          </div>
          <div className="toolbar__group">
            <label className="inline-field">
              <span className="sw-meta">Role</span>
              <select
                className="sw-input"
                value={roleId ?? ''}
                onChange={(e) => setRoleId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">All roles</option>
                {roles.data?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="search-wrap">
              <span className="sw-visually-hidden">Search people or tasks</span>
              <Search aria-hidden="true" />
              <input
                className="sw-input"
                type="search"
                placeholder="Search people or tasks"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
        </div>
        <div className="table-wrap">
          <table className="sw-table">
            <caption className="sw-visually-hidden">Tasks for each person on this day</caption>
            <thead>
              <tr>
                <th scope="col">Person</th>
                <th scope="col">Task</th>
                <th scope="col">Time window</th>
                <th scope="col">Status</th>
                <th scope="col">Completed</th>
              </tr>
            </thead>
            <tbody>
              {board.isPending && <SkeletonRows columns={5} />}
              {shown.map(({ member, o }) => (
                <tr key={`${member.id}-${o.task.id}-${o.period_date}`}>
                  <th scope="row">
                    <Link to={`/reports/${member.id}`}>{member.full_name}</Link>
                    <span className="sw-meta">{member.roles.map((r) => r.name).join(', ') || 'No role'}</span>
                  </th>
                  <td>
                    <span className="cell-title">{o.task.title}</span>
                    <span className="sw-meta">{occurrenceContext(o)}</span>
                  </td>
                  <td className="sw-numeric">{windowLabel(o.task)}</td>
                  <td>
                    <StatusBadge status={o.status} />
                  </td>
                  <td>
                    {o.completion ? (
                      <>
                        <span className="sw-numeric">{formatClock(o.completion.completed_at, board.data!.timezone)}</span>
                        {o.completion.note && <span className="sw-meta">“{o.completion.note}”</span>}
                      </>
                    ) : (
                      <span className="sw-meta">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {board.isPending && <LoadingNote label="Loading the day's tasks" />}
        {board.data && rows.length === 0 && (
          <Empty
            title="Nothing scheduled for this day"
            action={
              roleId !== null ? (
                <button type="button" className="sw-btn" onClick={clearFilters}>
                  Show all roles
                </button>
              ) : (
                <Link to="/tasks/new" className="sw-btn">
                  Create a task
                </Link>
              )
            }
          >
            {roleId !== null ? 'No one in this role has tasks on this day.' : 'Tasks you create appear here for each person they apply to.'}
          </Empty>
        )}
        {board.data && rows.length > 0 && shown.length === 0 && (
          <Empty
            title="No matching tasks"
            action={
              <button type="button" className="sw-btn" onClick={clearFilters}>
                Clear filters
              </button>
            }
          >
            Try a different status, person or task name.
          </Empty>
        )}
        {board.data && (
          <p className="table-summary sw-meta" role="status">
            {shown.length} of {rows.length} tasks · {board.data.members.length} people
          </p>
        )}
      </section>
    </div>
  );
}
