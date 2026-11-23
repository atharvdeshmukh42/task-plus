import { ArrowLeft, CalendarClock } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../api/client';
import { useDeleteTask, useMembers, useRoles, useSaveTask, useTask } from '../api/hooks';
import type { Recurrence, Task, TaskInput } from '../api/types';
import { Dialog, ErrorPanel, Field } from '../components/ui';
import { describedBy, focusFirstInvalid } from '../lib/forms';
import { WEEKDAYS, WEEKDAY_NAMES, formatTime, scheduleLabel } from '../lib/format';

type Target = 'everyone' | 'role' | 'person';

interface FormState {
  title: string;
  description: string;
  target: Target;
  role_id: string;
  assignee_id: string;
  recurrence: Recurrence;
  days_of_week: number[];
  due_date: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

const EMPTY: FormState = {
  title: '',
  description: '',
  target: 'everyone',
  role_id: '',
  assignee_id: '',
  recurrence: 'once',
  days_of_week: [],
  due_date: '',
  start_date: '',
  end_date: '',
  start_time: '',
  end_time: '',
  is_active: true,
};

function fromTask(task: Task): FormState {
  return {
    title: task.title,
    description: task.description ?? '',
    target: task.role_id ? 'role' : task.assignee_id ? 'person' : 'everyone',
    role_id: task.role_id ? String(task.role_id) : '',
    assignee_id: task.assignee_id ? String(task.assignee_id) : '',
    recurrence: task.recurrence,
    days_of_week: task.days_of_week ?? [],
    due_date: task.due_date ?? '',
    start_date: task.start_date ?? '',
    end_date: task.end_date ?? '',
    start_time: formatTime(task.start_time),
    end_time: formatTime(task.end_time),
    is_active: task.is_active,
  };
}

function toInput(form: FormState): TaskInput {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    role_id: form.target === 'role' && form.role_id ? Number(form.role_id) : null,
    assignee_id: form.target === 'person' && form.assignee_id ? Number(form.assignee_id) : null,
    recurrence: form.recurrence,
    days_of_week: form.recurrence === 'specific_days' ? form.days_of_week : null,
    due_date: form.recurrence === 'once' ? form.due_date || null : null,
    start_date: form.start_date || null,
    end_date: form.end_date || null,
    start_time: form.start_time || null,
    end_time: form.end_time || null,
    is_active: form.is_active,
  };
}

function validate(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.title.trim()) errors.title = 'Enter a task title.';
  if (form.target === 'role' && !form.role_id) errors.role_id = 'Choose a role, or assign the task to all employees.';
  if (form.target === 'person' && !form.assignee_id) errors.assignee_id = 'Choose a person.';
  if (form.recurrence === 'specific_days' && form.days_of_week.length === 0) errors.days_of_week = 'Pick at least one day.';
  if (form.start_time && form.end_time && form.start_time >= form.end_time)
    errors.end_time = 'The end time must be later than the start time.';
  if (form.start_date && form.end_date && form.start_date > form.end_date)
    errors.end_date = 'The end date must be on or after the start date.';
  return errors;
}

const REPEATS: { value: Recurrence; label: string; hint: string }[] = [
  { value: 'once', label: 'One time', hint: 'Done once, with an optional due date' },
  { value: 'daily', label: 'Every day', hint: 'A fresh task each day' },
  { value: 'weekly', label: 'Once a week', hint: 'Any day, Monday to Sunday' },
  { value: 'specific_days', label: 'Specific days', hint: 'Only on the days you pick' },
];

export function TaskForm() {
  const params = useParams();
  const id = params.taskId ? Number(params.taskId) : null;
  const existing = useTask(id);

  if (id && existing.isError) {
    return (
      <div className="page page--narrow">
        <ErrorPanel title="Couldn't load this task" error={existing.error} onRetry={() => existing.refetch()} />
      </div>
    );
  }
  if (id && !existing.data) {
    return (
      <div className="page page--narrow">
        <p role="status" className="sw-meta">
          Loading task…
        </p>
      </div>
    );
  }
  return <TaskEditor key={id ?? 'new'} task={existing.data ?? null} />;
}

function TaskEditor({ task }: { task: Task | null }) {
  const id = task?.id ?? null;
  const navigate = useNavigate();
  const roles = useRoles();
  const members = useMembers();
  const save = useSaveTask();
  const remove = useDeleteTask();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<FormState>(() => (task ? fromTask(task) : EMPTY));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<unknown>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (save.isPending) return;
    const found = validate(form);
    setErrors(found);
    setFailure(null);
    if (Object.values(found).some(Boolean)) {
      focusFirstInvalid(formRef.current);
      return;
    }
    try {
      await save.mutateAsync({ id: id ?? undefined, body: toInput(form) });
      navigate('/tasks');
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) {
        setErrors(e.fields);
        focusFirstInvalid(formRef.current);
      } else setFailure(e);
    }
  }

  async function confirmRemove() {
    if (!id) return;
    try {
      await remove.mutateAsync(id);
      navigate('/tasks');
    } catch (e) {
      setConfirmDelete(false);
      setFailure(e);
    }
  }

  const activeMembers = members.data ?? [];
  const preview = toInput(form);
  const targetText =
    form.target === 'role'
      ? (roles.data?.find((r) => String(r.id) === form.role_id)?.name ?? 'a role')
      : form.target === 'person'
        ? (activeMembers.find((m) => String(m.id) === form.assignee_id)?.full_name ?? 'one person')
        : 'All employees';

  const err = (key: string) => errors[key] || undefined;

  return (
    <div className="page page--narrow">
      <Link to="/tasks" className="back-link">
        <ArrowLeft className="sw-icon" aria-hidden="true" />
        Tasks
      </Link>
      <div className="page-head">
        <div>
          <h1 className="sw-page-title">{id ? 'Edit task' : 'New task'}</h1>
          <p>Only the title is required. Everything else is optional.</p>
        </div>
      </div>
      {failure !== null && <ErrorPanel title="Couldn't save the task" error={failure} />}

      <form ref={formRef} onSubmit={submit} noValidate>
        <div className="sw-panel">
          <section className="form-section" aria-labelledby="details-heading">
            <div className="form-section__head">
              <h2 id="details-heading" className="sw-subheading">
                Details
              </h2>
            </div>
            <Field id="title" label="Title" error={err('title')}>
              <input
                id="title"
                className="sw-input"
                value={form.title}
                maxLength={160}
                onChange={(e) => set('title', e.target.value)}
                aria-invalid={Boolean(err('title'))}
                aria-describedby={describedBy('title', null, err('title'))}
                placeholder="e.g. Check fridge temperatures"
              />
            </Field>
            <Field id="description" label="Instructions" optional error={err('description')}>
              <textarea
                id="description"
                className="sw-input"
                value={form.description}
                maxLength={2000}
                onChange={(e) => set('description', e.target.value)}
              />
            </Field>
          </section>

          <section className="form-section" aria-labelledby="assign-heading">
            <fieldset>
              <legend className="form-section__head">
                <h2 id="assign-heading" className="sw-subheading">
                  Assign to
                </h2>
              </legend>
              <div className="choice-group">
                {(
                  [
                    ['everyone', 'All employees', 'Everyone with Employee access'],
                    ['role', 'A role', 'Everyone in that role'],
                    ['person', 'One person', 'A single member'],
                  ] as [Target, string, string][]
                ).map(([value, label, hint]) => (
                  <label key={value} className="choice">
                    <input type="radio" name="target" value={value} checked={form.target === value} onChange={() => set('target', value)} />
                    <span>
                      <strong>{label}</strong>
                      <span className="sw-meta">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {form.target === 'role' && (
              <div style={{ marginTop: 16 }}>
                <Field
                  id="role_id"
                  label="Role"
                  error={err('role_id')}
                  help={roles.data?.length === 0 ? <>No roles yet. <Link to="/roles">Create a role</Link> first.</> : undefined}
                >
                  <select
                    id="role_id"
                    className="sw-input"
                    value={form.role_id}
                    onChange={(e) => set('role_id', e.target.value)}
                    aria-invalid={Boolean(err('role_id'))}
                    aria-describedby={describedBy('role_id', roles.data?.length === 0, err('role_id'))}
                  >
                    <option value="">Choose a role</option>
                    {roles.data?.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.member_count} {r.member_count === 1 ? 'person' : 'people'})
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
            {form.target === 'person' && (
              <div style={{ marginTop: 16 }}>
                <Field id="assignee_id" label="Person" error={err('assignee_id')}>
                  <select
                    id="assignee_id"
                    className="sw-input"
                    value={form.assignee_id}
                    onChange={(e) => set('assignee_id', e.target.value)}
                    aria-invalid={Boolean(err('assignee_id'))}
                    aria-describedby={describedBy('assignee_id', null, err('assignee_id'))}
                  >
                    <option value="">Choose a person</option>
                    {activeMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                        {m.roles.length ? ` · ${m.roles.map((r) => r.name).join(', ')}` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
          </section>

          <section className="form-section" aria-labelledby="repeat-heading">
            <fieldset>
              <legend className="form-section__head">
                <h2 id="repeat-heading" className="sw-subheading">
                  Repeat
                </h2>
              </legend>
              <div className="choice-group">
                {REPEATS.map((r) => (
                  <label key={r.value} className="choice">
                    <input
                      type="radio"
                      name="recurrence"
                      value={r.value}
                      checked={form.recurrence === r.value}
                      onChange={() => set('recurrence', r.value)}
                    />
                    <span>
                      <strong>{r.label}</strong>
                      <span className="sw-meta">{r.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {form.recurrence === 'specific_days' && (
              <div className="form-field" style={{ marginTop: 16 }}>
                <span className="sw-label" id="days-label">
                  Days of the week
                </span>
                <div
                  className="day-picker"
                  role="group"
                  aria-labelledby="days-label"
                  aria-describedby={err('days_of_week') ? 'days_of_week-error' : undefined}
                >
                  {WEEKDAYS.map((label, day) => {
                    const on = form.days_of_week.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        className="sw-btn"
                        aria-pressed={on}
                        aria-label={WEEKDAY_NAMES[day]}
                        aria-invalid={day === 0 && Boolean(err('days_of_week')) ? true : undefined}
                        onClick={() =>
                          set(
                            'days_of_week',
                            on ? form.days_of_week.filter((d) => d !== day) : [...form.days_of_week, day].sort(),
                          )
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {err('days_of_week') && (
                  <p id="days_of_week-error" className="sw-error">
                    {err('days_of_week')}
                  </p>
                )}
              </div>
            )}
            {form.recurrence === 'once' && (
              <div style={{ marginTop: 16 }}>
                <Field id="due_date" label="Due date" optional help="Without a due date the task stays open until someone does it.">
                  <input
                    id="due_date"
                    className="sw-input"
                    type="date"
                    value={form.due_date}
                    onChange={(e) => set('due_date', e.target.value)}
                    aria-describedby="due_date-help"
                  />
                </Field>
              </div>
            )}
          </section>

          <section className="form-section" aria-labelledby="time-heading">
            <div className="form-section__head">
              <h2 id="time-heading" className="sw-subheading">
                Time window <span className="optional sw-meta">Optional</span>
              </h2>
              <p>Completing after the end time is recorded as late. Leave empty for any time of day.</p>
            </div>
            <div className="field-row">
              <Field id="start_time" label="Start time" error={err('start_time')}>
                <input id="start_time" className="sw-input" type="time" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} />
              </Field>
              <Field id="end_time" label="End time" error={err('end_time')}>
                <input
                  id="end_time"
                  className="sw-input"
                  type="time"
                  value={form.end_time}
                  onChange={(e) => set('end_time', e.target.value)}
                  aria-invalid={Boolean(err('end_time'))}
                  aria-describedby={describedBy('end_time', null, err('end_time'))}
                />
              </Field>
            </div>
          </section>

          <section className="form-section" aria-labelledby="dates-heading">
            <div className="form-section__head">
              <h2 id="dates-heading" className="sw-subheading">
                Active dates <span className="optional sw-meta">Optional</span>
              </h2>
              <p>Limit when the task appears. By default it starts today and never ends.</p>
            </div>
            <div className="field-row">
              <Field id="start_date" label="Starts on">
                <input id="start_date" className="sw-input" type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
              </Field>
              <Field id="end_date" label="Ends on" error={err('end_date')}>
                <input
                  id="end_date"
                  className="sw-input"
                  type="date"
                  value={form.end_date}
                  min={form.start_date || undefined}
                  onChange={(e) => set('end_date', e.target.value)}
                  aria-invalid={Boolean(err('end_date'))}
                  aria-describedby={describedBy('end_date', null, err('end_date'))}
                />
              </Field>
            </div>
            <label className="checkbox">
              <input type="checkbox" checked={!form.is_active} onChange={(e) => set('is_active', !e.target.checked)} />
              Paused — hide it from checklists until resumed
            </label>
          </section>

          <div className="summary-line" aria-live="polite">
            <CalendarClock aria-hidden="true" />
            <span>
              <strong>{form.title.trim() || 'This task'}</strong> · {targetText} · {scheduleLabel(preview)}
            </span>
          </div>
        </div>

        <div className="form-actions">
          <Link to="/tasks" className="sw-btn">
            Cancel
          </Link>
          <button className="sw-btn sw-btn--primary" type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : id ? 'Save changes' : 'Create task'}
          </button>
        </div>
      </form>

      {id && (
        <div className="sw-panel danger-zone">
          <div>
            <strong className="sw-subheading">Delete this task</strong>
            <p>Its completion history is deleted too. To keep the history, pause the task instead.</p>
          </div>
          <button type="button" className="sw-btn sw-btn--danger" onClick={() => setConfirmDelete(true)}>
            Delete task
          </button>
        </div>
      )}

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this task?">
        <p className="dialog-text">
          “{task?.title}” and every completion recorded for it will be removed from reports. This can't be undone.
        </p>
        <div className="form-actions">
          <button type="button" className="sw-btn" data-autofocus onClick={() => setConfirmDelete(false)}>
            Cancel
          </button>
          <button type="button" className="sw-btn sw-btn--danger" onClick={confirmRemove} disabled={remove.isPending}>
            {remove.isPending ? 'Deleting…' : 'Delete task and history'}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
