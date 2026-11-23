import { ChartColumn, Pencil, Plus, Search, ShieldCheck, UserRound } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../api/client';
import { useMembers, useRoles, useSaveMember, type MemberInput } from '../api/hooks';
import type { AccessLevel, User } from '../api/types';
import { useMeRequired } from '../auth/AuthContext';
import { Badge, Dialog, Empty, ErrorPanel, Field, LoadingNote, Notice, SkeletonRows } from '../components/ui';
import { describedBy, focusFirstInvalid } from '../lib/forms';
import { ACCESS_LABEL } from '../lib/format';

type Filter = 'all' | 'supervisor' | 'employee' | 'inactive';

function AccessBadge({ level }: { level: AccessLevel }) {
  if (level === 'owner')
    return (
      <Badge tone="info" icon={<ShieldCheck className="sw-icon" aria-hidden="true" />}>
        Owner
      </Badge>
    );
  if (level === 'supervisor')
    return (
      <Badge tone="info" icon={<UserRound className="sw-icon" aria-hidden="true" />}>
        Supervisor
      </Badge>
    );
  return <Badge>Employee</Badge>;
}

function MemberDialog({ member, onClose, onSaved }: { member: User | null; onClose: () => void; onSaved: (u: User, created: boolean) => void }) {
  const { user: me } = useMeRequired();
  const roles = useRoles();
  const save = useSaveMember();
  const formRef = useRef<HTMLFormElement>(null);
  const isOwner = me.access_level === 'owner';
  const isSelf = member?.id === me.id;
  const [values, setValues] = useState({
    full_name: member?.full_name ?? '',
    email: member?.email ?? '',
    phone: member?.phone ?? '',
    password: '',
    access_level: (member?.access_level === 'supervisor' ? 'supervisor' : 'employee') as 'employee' | 'supervisor',
    role_ids: member?.roles.map((r) => r.id) ?? [],
    is_active: member?.is_active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '', contact: '' }));
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (save.isPending) return;
    const found: Record<string, string> = {};
    if (!values.full_name.trim()) found.full_name = 'Enter their name.';
    if (!values.email.trim() && !values.phone.trim()) found.email = 'Add an email address or a phone number so they can sign in.';
    if (!member && values.password.length < 8) found.password = 'Use at least 8 characters.';
    if (member && values.password && values.password.length < 8) found.password = 'Use at least 8 characters.';
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length) {
      focusFirstInvalid(formRef.current);
      return;
    }
    const body: MemberInput & { id?: number } = {
      id: member?.id,
      full_name: values.full_name.trim(),
      email: values.email.trim() || null,
      phone: values.phone.trim() || null,
      role_ids: values.role_ids,
    };
    if (values.password) body.password = values.password;
    if (isOwner && member?.access_level !== 'owner') body.access_level = values.access_level;
    if (member && !isSelf && member.access_level !== 'owner') body.is_active = values.is_active;
    try {
      const saved = await save.mutateAsync(body);
      onSaved(saved, !member);
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) {
        setErrors(e.fields);
        focusFirstInvalid(formRef.current);
      } else setFailure(e instanceof Error ? e.message : 'Could not save.');
    }
  }

  const passwordHelp = member ? 'Leave empty to keep their current password.' : 'Share it with them privately. At least 8 characters.';

  return (
    <Dialog open onClose={onClose} title={member ? `Edit ${member.full_name}` : 'Add a person'} wide>
      <form ref={formRef} onSubmit={submit} noValidate>
        {failure && (
          <p className="sw-error form-error" role="alert">
            {failure}
          </p>
        )}
        <Field id="full_name" label="Full name" error={errors.full_name}>
          <input
            id="full_name"
            className="sw-input"
            value={values.full_name}
            maxLength={120}
            autoComplete="off"
            onChange={(e) => set('full_name', e.target.value)}
            aria-invalid={Boolean(errors.full_name)}
            aria-describedby={describedBy('full_name', null, errors.full_name)}
          />
        </Field>
        <div className="field-row">
          <Field id="email" label="Email" optional error={errors.email} help="They can sign in with email or phone.">
            <input
              id="email"
              className="sw-input"
              type="email"
              autoComplete="off"
              value={values.email}
              onChange={(e) => set('email', e.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={describedBy('email', true, errors.email)}
            />
          </Field>
          <Field id="phone" label="Phone" optional error={errors.phone}>
            <input
              id="phone"
              className="sw-input"
              type="tel"
              autoComplete="off"
              inputMode="tel"
              value={values.phone}
              placeholder="+91 98765 43210"
              onChange={(e) => set('phone', e.target.value)}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={describedBy('phone', null, errors.phone)}
            />
          </Field>
        </div>
        <Field id="password" label={member ? 'New password' : 'Temporary password'} optional={Boolean(member)} error={errors.password} help={passwordHelp}>
          <input
            id="password"
            className="sw-input"
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={(e) => set('password', e.target.value)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={describedBy('password', passwordHelp, errors.password)}
          />
        </Field>
        {isOwner && member?.access_level !== 'owner' && (
          <fieldset className="form-field">
            <legend className="sw-label">Access</legend>
            <div className="choice-group">
              <label className="choice">
                <input type="radio" name="access" checked={values.access_level === 'employee'} onChange={() => set('access_level', 'employee')} />
                <span>
                  <strong>Employee</strong>
                  <span className="sw-meta">Sees their own tasks in the app</span>
                </span>
              </label>
              <label className="choice">
                <input type="radio" name="access" checked={values.access_level === 'supervisor'} onChange={() => set('access_level', 'supervisor')} />
                <span>
                  <strong>Supervisor</strong>
                  <span className="sw-meta">Manages people, roles, tasks and reports</span>
                </span>
              </label>
            </div>
          </fieldset>
        )}
        <fieldset className="form-field">
          <legend className="sw-label">Roles</legend>
          {roles.data?.length === 0 ? (
            <p className="sw-meta field-help">
              No roles yet. <Link to="/roles">Create roles</Link> to assign tasks to groups.
            </p>
          ) : (
            <div className="checkbox-list">
              {roles.data?.map((role) => (
                <label key={role.id} className="checkbox">
                  <input
                    type="checkbox"
                    checked={values.role_ids.includes(role.id)}
                    onChange={(e) =>
                      set('role_ids', e.target.checked ? [...values.role_ids, role.id] : values.role_ids.filter((r) => r !== role.id))
                    }
                  />
                  {role.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>
        {member && !isSelf && member.access_level !== 'owner' && (
          <label className="checkbox">
            <input type="checkbox" checked={!values.is_active} onChange={(e) => set('is_active', !e.target.checked)} />
            Deactivated — can't sign in and gets no new tasks
          </label>
        )}
        <div className="form-actions">
          <button type="button" className="sw-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="sw-btn sw-btn--primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : member ? 'Save changes' : 'Add person'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function People() {
  const { user: me } = useMeRequired();
  const members = useMembers({ include_inactive: true });
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<{ member: User | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const all = members.data ?? [];
  const needle = query.trim().toLocaleLowerCase();
  const searched = all.filter(
    (m) =>
      !needle ||
      `${m.full_name} ${m.email ?? ''} ${m.phone ?? ''} ${m.roles.map((r) => r.name).join(' ')}`.toLocaleLowerCase().includes(needle),
  );
  const matches = (m: User, f: Filter) =>
    f === 'all' ? m.is_active : f === 'inactive' ? !m.is_active : m.is_active && (f === 'supervisor' ? m.access_level !== 'employee' : m.access_level === 'employee');
  const shown = searched.filter((m) => matches(m, filter));
  const canEdit = (m: User) => me.access_level === 'owner' || m.id === me.id || m.access_level === 'employee';
  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: 'Active' },
    { value: 'supervisor', label: 'Owner & supervisors' },
    { value: 'employee', label: 'Employees' },
    { value: 'inactive', label: 'Deactivated' },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="sw-page-title">People</h1>
          <p>
            {me.access_level === 'owner'
              ? 'Add employees and choose who supervises.'
              : 'Add employees and give them roles. Only the owner can add supervisors.'}
          </p>
        </div>
        <button type="button" className="sw-btn sw-btn--primary" onClick={() => setEditing({ member: null })}>
          <Plus className="sw-icon" aria-hidden="true" />
          Add person
        </button>
      </div>
      {notice && <Notice message={notice} onDismiss={() => setNotice(null)} />}
      {members.isError && <ErrorPanel title="Couldn't load people" error={members.error} onRetry={() => members.refetch()} />}

      <section className="sw-panel" aria-label="People">
        <div className="toolbar">
          <div className="filters" role="group" aria-label="Filter people">
            {filters.map((f) => (
              <button key={f.value} type="button" className="sw-btn sw-btn--quiet filter" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
                {f.label} <span className="count">{searched.filter((m) => matches(m, f.value)).length}</span>
              </button>
            ))}
          </div>
          <label className="search-wrap">
            <span className="sw-visually-hidden">Search people</span>
            <Search aria-hidden="true" />
            <input className="sw-input" type="search" placeholder="Search name, contact or role" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </div>
        <div className="table-wrap">
          <table className="sw-table">
            <caption className="sw-visually-hidden">People in your organization</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Sign-in</th>
                <th scope="col">Access</th>
                <th scope="col">Roles</th>
                <th scope="col">
                  <span className="sw-visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {members.isPending && <SkeletonRows columns={5} />}
              {shown.map((m) => (
                <tr key={m.id} className={m.is_active ? undefined : 'muted-row'}>
                  <th scope="row">
                    {m.full_name}
                    {m.id === me.id && <span className="sw-meta">You</span>}
                    {!m.is_active && <span className="sw-meta">Deactivated</span>}
                  </th>
                  <td>
                    {m.email && <span>{m.email}</span>}
                    {m.phone && <span className={m.email ? 'sw-meta' : undefined}>{m.phone}</span>}
                  </td>
                  <td>
                    <AccessBadge level={m.access_level} />
                  </td>
                  <td>
                    {m.roles.length ? (
                      <span className="tags">
                        {m.roles.map((r) => (
                          <span key={r.id} className="tag">
                            {r.name}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="sw-meta">No role</span>
                    )}
                  </td>
                  <td className="actions-cell">
                    <Link to={`/reports/${m.id}`} className="sw-btn sw-btn--quiet" aria-label={`Report for ${m.full_name}`}>
                      <ChartColumn className="sw-icon" aria-hidden="true" />
                      Report
                    </Link>
                    {canEdit(m) && (
                      <button type="button" className="sw-btn sw-btn--quiet" onClick={() => setEditing({ member: m })} aria-label={`Edit ${m.full_name}`}>
                        <Pencil className="sw-icon" aria-hidden="true" />
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {members.isPending && <LoadingNote label="Loading people" />}
        {members.data && all.length <= 1 && filter !== 'inactive' && (
          <Empty
            title="Add your team"
            action={
              <button type="button" className="sw-btn sw-btn--primary" onClick={() => setEditing({ member: null })}>
                <Plus className="sw-icon" aria-hidden="true" />
                Add person
              </button>
            }
          >
            Give each person an email or phone number and a temporary password. Employees use them to sign in to the mobile app.
          </Empty>
        )}
        {members.data && all.length > 1 && shown.length === 0 && (
          <Empty
            title="No matching people"
            action={
              <button type="button" className="sw-btn" onClick={() => { setFilter('all'); setQuery(''); }}>
                Clear filters
              </button>
            }
          />
        )}
        {members.data && (
          <p className="table-summary sw-meta">
            {shown.length} of {all.length} people
          </p>
        )}
      </section>

      {editing && (
        <MemberDialog
          key={editing.member?.id ?? 'new'}
          member={editing.member}
          onClose={() => setEditing(null)}
          onSaved={(u, created) => {
            setEditing(null);
            setNotice(created ? `${u.full_name} added as ${ACCESS_LABEL[u.access_level].toLowerCase()}` : `${u.full_name} updated`);
          }}
        />
      )}
    </div>
  );
}
