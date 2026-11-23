import { CircleCheck, CirclePause, Pencil, Plus, Search, Tag, UserRound, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useRoles, useSetTaskActive, useTasks } from '../api/hooks';
import type { Task } from '../api/types';
import { Badge, Empty, ErrorPanel, LoadingNote, Notice, SkeletonRows } from '../components/ui';
import { assigneeLabel, repeatLabel, windowLabel } from '../lib/format';

type Filter = 'all' | 'active' | 'paused';

export function TargetLabel({ task }: { task: Pick<Task, 'role' | 'assignee'> }) {
  const Icon = task.role ? Tag : task.assignee ? UserRound : Users;
  return (
    <span className="target">
      <Icon aria-hidden="true" />
      {assigneeLabel(task)}
    </span>
  );
}

export function Tasks() {
  const tasks = useTasks();
  const roles = useRoles();
  const setActive = useSetTaskActive();
  const [filter, setFilter] = useState<Filter>('active');
  const [roleId, setRoleId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<{ message: string; undo?: Task } | null>(null);

  const all = tasks.data ?? [];
  const needle = query.trim().toLocaleLowerCase();
  const matching = all.filter(
    (t) =>
      (roleId === null || t.role_id === roleId) &&
      (!needle || `${t.title} ${t.description ?? ''} ${assigneeLabel(t)}`.toLocaleLowerCase().includes(needle)),
  );
  const counts = {
    all: matching.length,
    active: matching.filter((t) => t.is_active).length,
    paused: matching.filter((t) => !t.is_active).length,
  };
  const shown = matching.filter((t) => filter === 'all' || (filter === 'active') === t.is_active);

  async function toggle(task: Task, undoing = false) {
    const next = !task.is_active;
    try {
      await setActive.mutateAsync({ id: task.id, is_active: next });
      setNotice(
        undoing
          ? { message: `${task.title} is ${next ? 'active' : 'paused'} again` }
          : { message: `${task.title} ${next ? 'resumed' : 'paused'}`, undo: { ...task, is_active: next } },
      );
    } catch (e) {
      setNotice({ message: e instanceof Error ? e.message : 'Could not update the task.' });
    }
  }

  const clearFilters = () => {
    setFilter('all');
    setRoleId(null);
    setQuery('');
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="sw-page-title">Tasks</h1>
          <p>Assign work to everyone, a role or one person, on any schedule.</p>
        </div>
        <Link to="/tasks/new" className="sw-btn sw-btn--primary">
          <Plus className="sw-icon" aria-hidden="true" />
          New task
        </Link>
      </div>

      {notice && (
        <Notice
          message={notice.message}
          onDismiss={() => setNotice(null)}
          action={
            notice.undo ? (
              <button type="button" className="sw-btn" disabled={setActive.isPending} onClick={() => toggle(notice.undo!, true)}>
                Undo
              </button>
            ) : undefined
          }
        />
      )}
      {tasks.isError && <ErrorPanel title="Couldn't load tasks" error={tasks.error} onRetry={() => tasks.refetch()} />}

      <section className="sw-panel" aria-label="Tasks">
        <div className="toolbar">
          <div className="filters" role="group" aria-label="Filter by state">
            {(['all', 'active', 'paused'] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                className="sw-btn sw-btn--quiet filter"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Paused'} <span className="count">{counts[f]}</span>
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
              <span className="sw-visually-hidden">Search tasks</span>
              <Search aria-hidden="true" />
              <input
                className="sw-input"
                type="search"
                placeholder="Search tasks or people"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
        </div>
        <div className="table-wrap">
          <table className="sw-table">
            <caption className="sw-visually-hidden">Tasks and their schedules</caption>
            <thead>
              <tr>
                <th scope="col">Task</th>
                <th scope="col">Assigned to</th>
                <th scope="col">Repeats</th>
                <th scope="col">Time window</th>
                <th scope="col">State</th>
                <th scope="col">
                  <span className="sw-visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {tasks.isPending && <SkeletonRows columns={6} />}
              {shown.map((task) => (
                <tr key={task.id} className={task.is_active ? undefined : 'muted-row'}>
                  <th scope="row">
                    <Link to={`/tasks/${task.id}`}>{task.title}</Link>
                    {task.description && <span className="sw-meta">{task.description}</span>}
                  </th>
                  <td>
                    <TargetLabel task={task} />
                  </td>
                  <td>{repeatLabel(task)}</td>
                  <td className="sw-numeric">{windowLabel(task)}</td>
                  <td>
                    {task.is_active ? (
                      <Badge tone="success" icon={<CircleCheck className="sw-icon" aria-hidden="true" />}>
                        Active
                      </Badge>
                    ) : (
                      <Badge icon={<CirclePause className="sw-icon" aria-hidden="true" />}>Paused</Badge>
                    )}
                  </td>
                  <td className="actions-cell">
                    <Link to={`/tasks/${task.id}`} className="sw-btn sw-btn--quiet" aria-label={`Edit ${task.title}`}>
                      <Pencil className="sw-icon" aria-hidden="true" />
                      Edit
                    </Link>
                    <button
                      type="button"
                      className="sw-btn sw-btn--quiet"
                      onClick={() => toggle(task)}
                      disabled={setActive.isPending}
                      aria-label={`${task.is_active ? 'Pause' : 'Resume'} ${task.title}`}
                    >
                      {task.is_active ? 'Pause' : 'Resume'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tasks.isPending && <LoadingNote label="Loading tasks" />}
        {tasks.data && all.length === 0 && (
          <Empty
            title="Create your first task"
            action={
              <Link to="/tasks/new" className="sw-btn sw-btn--primary">
                <Plus className="sw-icon" aria-hidden="true" />
                New task
              </Link>
            }
          >
            A task can repeat every day, once a week or on chosen days, with an optional time window.
          </Empty>
        )}
        {tasks.data && all.length > 0 && shown.length === 0 && (
          <Empty
            title="No matching tasks"
            action={
              <button type="button" className="sw-btn" onClick={clearFilters}>
                Clear filters
              </button>
            }
          >
            Try another state, role or search term.
          </Empty>
        )}
        {tasks.data && all.length > 0 && (
          <p className="table-summary sw-meta">
            {shown.length} of {all.length} tasks
          </p>
        )}
      </section>
    </div>
  );
}
