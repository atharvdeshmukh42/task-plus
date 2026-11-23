import { CircleAlert, CircleCheck, CircleX, Clock3, Gauge } from 'lucide-react';
import { useState } from 'react';
import type { DayTally, Tally } from '../api/types';
import { formatDayMonth, formatShortDate, percent, presetRange, type RangePreset } from '../lib/format';

/* ---------- Stat tiles ---------- */

export function StatTiles({ summary, openLabel = 'Open' }: { summary: Tally; openLabel?: string }) {
  const closed = summary.done + summary.late + summary.missed;
  const tiles = [
    {
      label: 'Completion rate',
      value: percent(summary.completion_rate),
      note: closed ? `${summary.done + summary.late} of ${closed} closed tasks done` : 'No closed tasks yet',
      tone: 'info',
      Icon: Gauge,
    },
    { label: 'Done on time', value: summary.done, note: `On-time rate ${percent(summary.on_time_rate)}`, tone: 'success', Icon: CircleCheck },
    { label: 'Done late', value: summary.late, note: 'After the time window', tone: 'warning', Icon: CircleAlert },
    { label: 'Missed', value: summary.missed, note: 'Not done by the deadline', tone: 'danger', Icon: CircleX },
    { label: openLabel, value: summary.open, note: 'Still to do', tone: '', Icon: Clock3 },
  ];
  return (
    <div className="stats">
      {tiles.map(({ label, value, note, tone, Icon }) => (
        <div key={label} className={`sw-panel stat${tone ? ` stat--${tone}` : ''}`}>
          <div className="stat__label">
            <Icon aria-hidden="true" />
            {label}
          </div>
          <div className="stat__value">{value}</div>
          <div className="stat__note">{note}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Daily stacked bars ---------- */

const SERIES = [
  { key: 'done', label: 'Done', color: 'var(--chart-done)' },
  { key: 'late', label: 'Done late', color: 'var(--chart-late)' },
  { key: 'missed', label: 'Missed', color: 'var(--chart-missed)' },
  { key: 'open', label: 'Open', color: 'var(--chart-open)' },
] as const;

/** A round axis maximum whose midpoint is also a whole number. */
function niceMax(value: number): number {
  const half = Math.max(1, value / 2);
  const magnitude = 10 ** Math.floor(Math.log10(half));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * magnitude).find((m) => m >= half && Number.isInteger(m));
  return 2 * (step ?? Math.ceil(half));
}

export function DayBars({ days, title = 'Tasks per day' }: { days: DayTally[]; title?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...days.map((d) => d.total)));
  const ticks = [0, max / 2, max];
  const labelEvery = days.length > 16 ? Math.ceil(days.length / 8) : 1;
  const hovered = active === null ? null : days[active];

  return (
    <figure className="sw-panel chart" style={{ margin: 0 }}>
      <div className="chart__head">
        <figcaption className="sw-subheading">{title}</figcaption>
        <ul className="legend" aria-label="Legend">
          {SERIES.map((s) => (
            <li key={s.key}>
              <i style={{ background: s.color }} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
      </div>
      <div className="chart__plot">
        <div className="chart__axis" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} style={{ bottom: `${(t / max) * 100}%` }}>
              {t}
            </span>
          ))}
        </div>
        <div className="chart__area" onMouseLeave={() => setActive(null)}>
          {ticks.slice(1).map((t) => (
            <div key={t} className="chart__grid" style={{ bottom: `${(t / max) * 100}%` }} aria-hidden="true" />
          ))}
          <div className="chart__bars">
            {days.map((day, index) => {
              const description = `${formatShortDate(day.date)}: ${day.done} done, ${day.late} late, ${day.missed} missed, ${day.open} open`;
              return (
                <div
                  key={day.date}
                  className="chart__slot"
                  tabIndex={0}
                  role="img"
                  aria-label={description}
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                >
                  <div className="chart__stack">
                    {SERIES.filter((s) => day[s.key] > 0).map((s) => (
                      <span
                        key={s.key}
                        className="chart__seg"
                        style={{ height: `calc(${(day[s.key] / max) * 10}rem - 2px)`, background: s.color }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {days.every((d) => d.total === 0) && <div className="chart__empty sw-meta">No tasks in this range</div>}
          {hovered && active !== null && (
            <div
              className="chart__tooltip"
              style={
                active < days.length / 2
                  ? { top: 8, left: `calc(${((active + 1) / days.length) * 100}% + 4px)` }
                  : { top: 8, right: `calc(${((days.length - active) / days.length) * 100}% + 4px)` }
              }
              aria-hidden="true"
            >
              <strong>{formatShortDate(hovered.date)}</strong>
              <div className="tip-grid">
                {SERIES.map((s) => (
                  <span key={s.key} className="tip-row">
                    <i style={{ background: s.color }} />
                    <span>{s.label}</span>
                    <b>{hovered[s.key]}</b>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="chart__labels" aria-hidden="true">
        {days.map((day, index) => (
          <span key={day.date}>{index % labelEvery === 0 ? formatDayMonth(day.date) : ''}</span>
        ))}
      </div>
    </figure>
  );
}

/* ---------- Completion rate cell ---------- */

export function RateCell({ value }: { value: number | null }) {
  return (
    <span className="rate-cell">
      <span className="sw-numeric">{percent(value)}</span>
      <span className="rate-bar" aria-hidden="true">
        <span style={{ width: `${Math.round((value ?? 0) * 100)}%` }} />
      </span>
    </span>
  );
}

/* ---------- Date range ---------- */

export function RangePicker({
  preset,
  start,
  end,
  today,
  onChange,
}: {
  preset: RangePreset;
  start: string;
  end: string;
  today: string;
  onChange: (next: { preset: RangePreset; start: string; end: string }) => void;
}) {
  const presets: { value: RangePreset; label: string }[] = [
    { value: '7', label: 'Last 7 days' },
    { value: '14', label: 'Last 14 days' },
    { value: '30', label: 'Last 30 days' },
    { value: 'custom', label: 'Custom' },
  ];
  return (
    <div className="toolbar__group">
      <div className="filters" role="group" aria-label="Date range">
        {presets.map((p) => (
          <button
            key={p.value}
            type="button"
            className="sw-btn sw-btn--quiet filter"
            aria-pressed={preset === p.value}
            onClick={() =>
              onChange(p.value === 'custom' ? { preset: 'custom', start, end } : { preset: p.value, ...presetRange(p.value, today) })
            }
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <>
          <label className="inline-field">
            <span className="sw-meta">From</span>
            <input
              className="sw-input"
              type="date"
              value={start}
              max={end}
              onChange={(e) => e.target.value && onChange({ preset, start: e.target.value, end })}
            />
          </label>
          <label className="inline-field">
            <span className="sw-meta">To</span>
            <input
              className="sw-input"
              type="date"
              value={end}
              min={start}
              max={today}
              onChange={(e) => e.target.value && onChange({ preset, start, end: e.target.value })}
            />
          </label>
        </>
      )}
    </div>
  );
}
