import { useMemo, useState, type FormEvent } from 'react';
import { useChangePassword, useUpdateOrganization } from '../api/hooks';
import { useMeRequired } from '../auth/AuthContext';
import { Field, Notice } from '../components/ui';
import { describedBy } from '../lib/forms';
import { timezones } from '../lib/format';

function OrganizationForm() {
  const { user, organization } = useMeRequired();
  const update = useUpdateOrganization();
  const zones = useMemo(() => timezones(), []);
  const [name, setName] = useState(organization.name);
  const [timezone, setTimezone] = useState(organization.timezone);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'warning' } | null>(null);
  const canEdit = user.access_level === 'owner';

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (update.isPending) return;
    if (!name.trim()) {
      setMessage({ text: 'Enter an organization name.', tone: 'warning' });
      return;
    }
    try {
      await update.mutateAsync({ name: name.trim(), timezone });
      setMessage({ text: 'Organization saved', tone: 'success' });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Could not save.', tone: 'warning' });
    }
  }

  return (
    <form className="sw-panel form-section" onSubmit={submit} noValidate aria-labelledby="org-heading">
      <div className="form-section__head">
        <h2 id="org-heading" className="sw-section-title">
          Organization
        </h2>
        {!canEdit && <p>Only the owner can change these settings.</p>}
      </div>
      {message && <Notice message={message.text} tone={message.tone} onDismiss={() => setMessage(null)} />}
      <Field id="org-name" label="Name">
        <input id="org-name" className="sw-input" value={name} maxLength={120} disabled={!canEdit} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field id="org-timezone" label="Timezone" help="Days, weeks and time windows follow this timezone for everyone.">
        <select
          id="org-timezone"
          className="sw-input"
          value={timezone}
          disabled={!canEdit}
          onChange={(e) => setTimezone(e.target.value)}
          aria-describedby="org-timezone-help"
        >
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </Field>
      {canEdit && (
        <div className="form-actions">
          <button type="submit" className="sw-btn sw-btn--primary" disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save organization'}
          </button>
        </div>
      )}
    </form>
  );
}

function PasswordForm() {
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (change.isPending) return;
    setDone(false);
    if (next.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    try {
      await change.mutateAsync({ current_password: current, new_password: next });
      setCurrent('');
      setNext('');
      setError(null);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change the password.');
    }
  }

  return (
    <form className="sw-panel form-section" onSubmit={submit} noValidate aria-labelledby="password-heading">
      <div className="form-section__head">
        <h2 id="password-heading" className="sw-section-title">
          Your password
        </h2>
      </div>
      {done && <Notice message="Password changed" onDismiss={() => setDone(false)} />}
      <div className="field-row">
        <Field id="current-password" label="Current password">
          <input
            id="current-password"
            className="sw-input"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <Field id="new-password" label="New password" error={error} help="At least 8 characters.">
          <input
            id="new-password"
            className="sw-input"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => {
              setNext(e.target.value);
              setError(null);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy('new-password', true, error)}
          />
        </Field>
      </div>
      <div className="form-actions">
        <button type="submit" className="sw-btn sw-btn--primary" disabled={change.isPending || !current || !next}>
          {change.isPending ? 'Changing…' : 'Change password'}
        </button>
      </div>
    </form>
  );
}

export function Settings() {
  return (
    <div className="page page--narrow">
      <div className="page-head">
        <div>
          <h1 className="sw-page-title">Settings</h1>
        </div>
      </div>
      <div className="settings-grid">
        <OrganizationForm />
        <PasswordForm />
      </div>
    </div>
  );
}
