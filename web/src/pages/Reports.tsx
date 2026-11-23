import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMemberReport, useRoles, useTeamReport } from '../api/hooks';
import type { TaskTally } from '../api/types';
import { useMeRequired } from '../auth/AuthContext';
import { DayBars, RangePicker, RateCell, StatTiles } from '../components/reports';
import { Empty, ErrorPanel, LoadingNote, SkeletonRows, StatusBadge } from '../components/ui';
import { ACCESS_LABEL, formatRange, formatShortDate, formatStamp, presetRange, repeatLabel, toDay, type RangePreset } from '../lib/format';
import { TargetLabel } from './Tasks';

/** "Today" in the organization's timezone, so ranges line up with the server. */
function orgToday(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    return parts;
  } catch {
    return toDay(new Date());
  }
}

function useRange() {
  const { organization } = useMeRequired();
  const today = orgToday(organization.timezone);
  const [range, setRange] = useState<{ preset: RangePreset; start: string; end: string }>({ preset: '7', ...presetRange('7', today) });
  return { today, range, setRange };
}

function TaskTable({ tasks, caption }: { tasks: TaskTally[]; caption: string }) {
  return (
    <div className="table-wrap">
      <table className="sw-table" data-sw-density="compact">
        <caption className="sw-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Task</th>
            <th scope="col">Assigned to</th>
            <th scope="col" className="sw-number">Done</th>
            <th scope="col" className="sw-number">Late</th>
            <th scope="col" className="sw-number">Missed</th>
            <th scope="col" className="sw-number">Open</th>
            <th scope="col" className="sw-number">Completion</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(({ task, summary }) => (
            <tr key={task.id}>
              <th scope="row">
                {task.title}
                <span className="sw-meta">{repeatLabel(task)}</span>
              </th>
              <td>
                <TargetLabel task={task} />
              </td>
              <td className="sw-number">{summary.done}</td>
              <td className="sw-number">{summary.late}</td>
              <td className="sw-number">{summary.missed}</td>
              <td className="sw-number">{summary.open}</td>
              <td className="sw-number">
                <RateCell value={summary.completion_rate} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Reports() {
  const { today, range, setRange } = useRange();
  const [roleId, setRoleId] = useState<number | null>(null);
  const roles = useRoles();
  const report = useTeamReport(range.start, range.end, roleId);
  const data = report.data;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="sw-page-title">Reports</h1>
          <p>How the team kept up with its tasks · {formatRange(range.start, range.end)}</p>
        </div>
      </div>
      <div className="toolbar" style={{ padding: '0 0 16px' }}>
        <RangePicker {...range} today={today} onChange={setRange} />
        <label className="inline-field">
          <span className="sw-meta">Role</span>
          <select className="sw-input" value={roleId ?? ''} onChange={(e) => setRoleId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Everyone</option>
            {roles.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {report.isError && <ErrorPanel title="Couldn't load the report" error={report.error} onRetry={() => report.refetch()} />}
      {report.isPending && <LoadingNote label="Loading report" />}
      {data && <StatTiles summary={data.summary} />}
      {data && <DayBars days={data.days} />}

      <section className="section" aria-labelledby="people-heading">
        <div className="section-head">
          <h2 id="people-heading" className="sw-section-title">
            By person
          </h2>
          <span className="sw-meta">Lowest completion first</span>
        </div>
        <div className="sw-panel">
          <div className="table-wrap">
            <table className="sw-table">
              <caption className="sw-visually-hidden">Completion by person</caption>
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  <th scope="col" className="sw-number">Assigned</th>
                  <th scope="col" className="sw-number">Done</th>
                  <th scope="col" className="sw-number">Late</th>
                  <th scope="col" className="sw-number">Missed</th>
                  <th scope="col" className="sw-number">Open</th>
                  <th scope="col" className="sw-number">Completion</th>
                </tr>
              </thead>
              <tbody>
                {report.isPending && <SkeletonRows columns={7} rows={4} />}
                {data?.members.map(({ member, summary }) => (
                  <tr key={member.id}>
                    <th scope="row">
                      <Link to={`/reports/${member.id}`}>{member.full_name}</Link>
                      <span className="sw-meta">
                        {member.roles.map((r) => r.name).join(', ') || ACCESS_LABEL[member.access_level]}
                      </span>
                    </th>
                    <td className="sw-number">{summary.total}</td>
                    <td className="sw-number">{summary.done}</td>
                    <td className="sw-number">{summary.late}</td>
                    <td className="sw-number">{summary.missed}</td>
                    <td className="sw-number">{summary.open}</td>
                    <td className="sw-number">
                      <RateCell value={summary.completion_rate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && data.members.length === 0 && (
            <Empty title="No tasks in this range">Tasks appear here once they are assigned and their day has started.</Empty>
          )}
        </div>
      </section>

      {data && data.tasks.length > 0 && (
        <section className="section" aria-labelledby="tasks-heading">
          <div className="section-head">
            <h2 id="tasks-heading" className="sw-section-title">
              By task
            </h2>
            <span className="sw-meta">Most missed first</span>
          </div>
          <div className="sw-panel">
            <TaskTable tasks={data.tasks} caption="Completion by task" />
          </div>
        </section>
      )}
    </div>
  );
}

export function MemberReport() {
  const memberId = Number(useParams().memberId);
  const { organization } = useMeRequired();
  const { today, range, setRange } = useRange();
  const report = useMemberReport(memberId, range.start, range.end);
  const data = report.data;

  return (
    <div className="page">
      <Link to="/reports" className="back-link">
        <ArrowLeft className="sw-icon" aria-hidden="true" />
        Reports
      </Link>
      <div className="page-head">
        <div>
          <h1 className="sw-page-title">{data?.member.full_name ?? 'Report'}</h1>
          <p>
            {data
              ? `${ACCESS_LABEL[data.member.access_level]}${data.member.roles.length ? ` · ${data.member.roles.map((r) => r.name).join(', ')}` : ''} · `
              : ''}
            {formatRange(range.start, range.end)}
          </p>
        </div>
      </div>
      <div className="toolbar" style={{ padding: '0 0 16px' }}>
        <RangePicker {...range} today={today} onChange={setRange} />
      </div>

      {report.isError && <ErrorPanel title="Couldn't load the report" error={report.error} onRetry={() => report.refetch()} />}
      {report.isPending && <LoadingNote label="Loading report" />}
      {data && <StatTiles summary={data.summary} />}
      {data && <DayBars days={data.days} />}

      {data && data.tasks.length > 0 && (
        <section className="section" aria-labelledby="tasks-heading">
          <h2 id="tasks-heading" className="sw-section-title">
            By task
          </h2>
          <div className="sw-panel">
            <TaskTable tasks={data.tasks} caption="Completion by task" />
          </div>
        </section>
      )}

      <section className="section" aria-labelledby="history-heading">
        <h2 id="history-heading" className="sw-section-title">
          History
        </h2>
        <div className="sw-panel">
          <div className="table-wrap">
            <table className="sw-table" data-sw-density="compact">
              <caption className="sw-visually-hidden">Every task in the range, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col">Task</th>
                  <th scope="col">Status</th>
                  <th scope="col">Completed</th>
                  <th scope="col">Note</th>
                </tr>
              </thead>
              <tbody>
                {report.isPending && <SkeletonRows columns={5} rows={5} />}
                {data?.history.map((o) => (
                  <tr key={`${o.task.id}-${o.period_date}`}>
                    <th scope="row" className="sw-numeric">
                      {o.report_date ? formatShortDate(o.report_date) : 'Open'}
                    </th>
                    <td>
                      <span className="cell-title">{o.task.title}</span>
                      <span className="sw-meta">{o.scope === 'week' ? 'Once a week' : repeatLabel(o.task)}</span>
                    </td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="sw-numeric">{o.completion ? formatStamp(o.completion.completed_at, organization.timezone) : '—'}</td>
                    <td>{o.completion?.note ?? <span className="sw-meta">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && data.history.length === 0 && <Empty title="No tasks in this range">Try a longer range.</Empty>}
        </div>
      </section>
    </div>
  );
}
