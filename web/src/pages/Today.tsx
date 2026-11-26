import { ChevronLeft, ChevronRight, CircleAlert, CircleCheck, CircleX, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useBoard, useRoles } from '../api/hooks';
import type { MemberBrief, Occurrence, Status } from '../api/types';
import { Badge, Empty, ErrorPanel, LoadingNote, SkeletonRows, StatusBadge } from '../components/ui';
import { addDays, formatClock, formatLongDate, formatShortDate, plural, repeatLabel, windowLabel } from '../lib/format';

/* ---------- Status buckets ---------- */

type Bucket = 'overdue' | 'todo' | 'done' | 'late' | 'missed';
type Counts = Record<Bucket, number>;

const BUCKET_OF: Record<Status, Bucket> = {
  overdue: 'overdue',
  pending: 'todo',
  upcoming: 'todo',
  done: 'done',
  late: 'late',
  missed: 'missed',
};

/** Filter order: what needs attention first. */
const BUCKETS: { key: Bucket; label: string }[] = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'todo', label: 'To do' },
  { key: 'done', label: 'Done' },
  { key: 'late', label: 'Done late' },
  { key: 'missed', label: 'Missed' },
];

/** Bar order: finished work on the left, outstanding work on the right. */
const BAR_ORDER: Bucket[] = ['done', 'late', 'missed', 'overdue', 'todo'];

/** Row order inside each person: overdue first, finished work last. Server order (by time) breaks ties. */
const URGENCY: Record<Status, number> = { overdue: 0, missed: 1, pending: 2, upcoming: 3, late: 4, done: 5 };

function countBuckets(occurrences: Occurrence[]): Counts {
  const counts: Counts = { overdue: 0, todo: 0, done: 0, late: 0, missed: 0 };
  for (const o of occurrences) counts[BUCKET_OF[o.status]] += 1;
  return counts;
}

function describe(counts: Counts): string {
  return BAR_ORDER.filter((key) => counts[key] > 0)
    .map((key) => `${counts[key]} ${BUCKETS.find((b) => b.key === key)!.label.toLowerCase()}`)
    .join(', ');
}

/** Segmented progress bar. Without a label it is decorative (the text beside it says the same). */
function StatusBar({ counts, label }: { counts: Counts; label?: string }) {
  return (
    <span
      className={`status-bar${label ? '' : ' status-bar--small'}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {BAR_ORDER.map(
        (key) => counts[key] > 0 && <span key={key} className={`status-bar__seg swatch--${key}`} style={{ flexGrow: counts[key] }} />,
      )}
    </span>
  );
}

function AttentionBadges({ counts, allDone = false }: { counts: Counts; allDone?: boolean }) {
  return (
    <>
      {counts.overdue > 0 && (
        <Badge tone="warning" icon={<CircleAlert className="sw-icon" aria-hidden="true" />}>
          {counts.overdue} overdue
        </Badge>
      )}
      {counts.missed > 0 && (
        <Badge tone="danger" icon={<CircleX className="sw-icon" aria-hidden="true" />}>
          {counts.missed} missed
        </Badge>
      )}
      {allDone && (
        <Badge tone="success" icon={<CircleCheck className="sw-icon" aria-hidden="true" />}>
          All done
        </Badge>
      )}
    </>
  );
}

function occurrenceContext(o: Occurrence): string {
  if (o.scope === 'week' && o.due_date) return `Once this week · by ${formatShortDate(o.due_date)}`;
  return repeatLabel(o.task);
}

type Group = { member: MemberBrief; occurrences: Occurrence[]; counts: Counts; shown: Occurrence[] };

/* ---------- Page ---------- */

export function Today() {
  const [day, setDay] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<number | null>(null);
  const [filter, setFilter] = useState<Bucket | 'all'>('all');
  const [query, setQuery] = useState('');
  const board = useBoard(day, roleId);
  const roles = useRoles();

  const needle = query.trim().toLocaleLowerCase();
  const { groups, searched } = useMemo(() => {
    const all: Group[] = (board.data?.members ?? []).map(({ member, occurrences }) => {
      const nameMatches = !needle || member.full_name.toLocaleLowerCase().includes(needle);
      const ordered = [...occurrences].sort((a, b) => URGENCY[a.status] - URGENCY[b.status]);
      return {
        member,
        occurrences,
        counts: countBuckets(occurrences),
        // Narrowed by search only; the status filter applies below so its counts stay visible.
        shown: nameMatches ? ordered : ordered.filter((o) => o.task.title.toLocaleLowerCase().includes(needle)),
      };
    });
    return { groups: all, searched: all.flatMap((g) => g.shown) };
  }, [board.data, needle]);

  const totalRows = groups.reduce((sum, g) => sum + g.occurrences.length, 0);
  const counts = countBuckets(searched);
  const finished = counts.done + counts.late;
  const visible = groups
    .map((g) => ({ ...g, shown: filter === 'all' ? g.shown : g.shown.filter((o) => BUCKET_OF[o.status] === filter) }))
    .filter((g) => g.shown.length > 0);
  const shownRows = visible.reduce((sum, g) => sum + g.shown.length, 0);

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

      <section className="sw-panel" aria-label="Team checklist">
        <div className="day-summary">
          {board.isPending ? (
            <span className="skeleton" style={{ width: '12rem', height: 20 }} aria-hidden="true" />
          ) : (
            <div className="day-summary__head">
              <p className="day-summary__headline">
                <strong className="sw-numeric">{finished}</strong> of <span className="sw-numeric">{searched.length}</span> done
              </p>
              <div className="day-summary__badges">
                <AttentionBadges counts={counts} allDone={searched.length > 0 && finished === searched.length} />
              </div>
            </div>
          )}
          <StatusBar counts={counts} label={searched.length ? describe(counts) : 'No tasks'} />
        </div>

        <div className="toolbar">
          <div className="filters" role="group" aria-label="Filter by status">
            <button type="button" className="sw-btn sw-btn--quiet filter" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
              All <span className="count">{searched.length}</span>
            </button>
            {BUCKETS.map((b) => (
              <button
                key={b.key}
                type="button"
                className="sw-btn sw-btn--quiet filter"
                aria-pressed={filter === b.key}
                onClick={() => setFilter(b.key)}
              >
                <i className={`swatch swatch--${b.key}`} aria-hidden="true" />
                {b.label} <span className="count">{counts[b.key]}</span>
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
          <table className="sw-table board-table">
            <caption className="sw-visually-hidden">Tasks for each person on this day, grouped by person</caption>
            <thead>
              <tr>
                <th scope="col">Task</th>
                <th scope="col">Time window</th>
                <th scope="col">Status</th>
                <th scope="col">Completed</th>
              </tr>
            </thead>
            {board.isPending && (
              <tbody>
                <SkeletonRows columns={4} />
              </tbody>
            )}
            {visible.map(({ member, occurrences, counts: personCounts, shown }) => (
              <tbody key={member.id} className="board-group">
                <tr className="board-group__head">
                  <th scope="rowgroup" colSpan={4}>
                    <div className="person-head">
                      <div className="person-head__name">
                        <Link to={`/reports/${member.id}`}>{member.full_name}</Link>
                        <span className="sw-meta">{member.roles.map((r) => r.name).join(', ') || 'No role'}</span>
                      </div>
                      <div className="person-head__progress">
                        <AttentionBadges counts={personCounts} />
                        <span className="sw-meta sw-numeric">
                          {personCounts.done + personCounts.late} of {occurrences.length} done
                        </span>
                        <StatusBar counts={personCounts} />
                      </div>
                    </div>
                  </th>
                </tr>
                {shown.map((o) => (
                  <tr key={`${o.task.id}-${o.period_date}`}>
                    <th scope="row">
                      <span className="cell-title">{o.task.title}</span>
                      <span className="sw-meta">{occurrenceContext(o)}</span>
                    </th>
                    <td className="sw-numeric board-table__window">{windowLabel(o.task)}</td>
                    <td className="board-table__status">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className={`board-table__completed${o.completion ? '' : ' cell-empty'}`}>
                      {o.completion ? (
                        <>
                          <span className="sw-numeric">
                            <span className="board-table__done-label">Done at </span>
                            {formatClock(o.completion.completed_at, board.data!.timezone)}
                          </span>
                          {o.completion.note && <span className="sw-meta">“{o.completion.note}”</span>}
                        </>
                      ) : (
                        <span className="sw-meta">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        {board.isPending && <LoadingNote label="Loading the day's tasks" />}
        {board.data && totalRows === 0 && (
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
        {board.data && totalRows > 0 && shownRows === 0 && (
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
            {shownRows} of {plural(totalRows, 'task')} · {visible.length} of {plural(groups.length, 'person', 'people')}
          </p>
        )}
      </section>
    </div>
  );
}
