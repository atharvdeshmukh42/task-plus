import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiError, api } from '../api/client';
import type { Session } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Logo } from '../components/Logo';
import { ErrorPanel, Field } from '../components/ui';
import { describedBy, focusFirstInvalid } from '../lib/forms';
import { browserTimezone, timezones } from '../lib/format';

function Brand() {
  return (
    <div className="auth__brand">
      <Logo size={36} />
    </div>
  );
}

export function SignIn() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const session = await api<Session>('/auth/login', { method: 'POST', body: { identifier, password } });
      signIn(session);
      navigate('/', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth">
      <form className="sw-panel auth__card" onSubmit={submit} noValidate>
        <Brand />
        <h1 className="sw-page-title">Sign in</h1>
        <p>Plan, assign and track your team's tasks.</p>
        {error && (
          <p className="sw-error form-error" role="alert">
            {error}
          </p>
        )}
        <Field id="identifier" label="Email or phone number">
          <input
            id="identifier"
            className="sw-input"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
        </Field>
        <Field id="password" label="Password">
          <input
            id="password"
            className="sw-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <button className="sw-btn sw-btn--primary" type="submit" disabled={pending || !identifier || !password}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="auth__switch">
          New to Task Plus? <Link to="/sign-up">Create an organization</Link>
        </p>
      </form>
    </div>
  );
}

export function SignUp() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const zones = useMemo(() => timezones(), []);
  const [values, setValues] = useState({
    organization_name: '',
    full_name: '',
    email: '',
    password: '',
    timezone: browserTimezone(),
  });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  const set = (key: keyof typeof values) => (value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setFields((f) => ({ ...f, [key]: '' }));
  };

  function validate(): Record<string, string> {
    const found: Record<string, string> = {};
    if (!values.organization_name.trim()) found.organization_name = 'Enter your organization name.';
    if (!values.full_name.trim()) found.full_name = 'Enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) found.email = 'Enter an email address like name@company.com.';
    if (values.password.length < 8) found.password = 'Use at least 8 characters.';
    return found;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const found = validate();
    setFields(found);
    setError(null);
    if (Object.keys(found).length) {
      focusFirstInvalid(formRef.current);
      return;
    }
    setPending(true);
    try {
      const session = await api<Session>('/auth/signup', { method: 'POST', body: { ...values, email: values.email.trim() } });
      signIn(session);
      navigate('/', { replace: true });
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) {
        setFields(e.fields);
        focusFirstInvalid(formRef.current);
      } else setError(e);
    } finally {
      setPending(false);
    }
  }

  const input = (key: keyof typeof values, label: string, props: Record<string, string> = {}, help?: string) => (
    <Field id={key} label={label} error={fields[key]} help={help}>
      <input
        id={key}
        className="sw-input"
        value={values[key]}
        onChange={(e) => set(key)(e.target.value)}
        aria-invalid={Boolean(fields[key])}
        aria-describedby={describedBy(key, help, fields[key])}
        {...props}
      />
    </Field>
  );

  return (
    <div className="auth">
      <form ref={formRef} className="sw-panel auth__card" onSubmit={submit} noValidate>
        <Brand />
        <h1 className="sw-page-title">Create your organization</h1>
        <p>You'll be its owner. Add supervisors and employees next.</p>
        {error !== null && <ErrorPanel title="Couldn't create the organization" error={error} />}
        {input('organization_name', 'Organization name', { autoComplete: 'organization', maxLength: '120' })}
        {input('full_name', 'Your name', { autoComplete: 'name', maxLength: '120' })}
        {input('email', 'Work email', { type: 'email', autoComplete: 'email' })}
        {input('password', 'Password', { type: 'password', autoComplete: 'new-password' }, 'At least 8 characters.')}
        <Field id="timezone" label="Timezone" help="Task days and time windows follow this timezone.">
          <select
            id="timezone"
            className="sw-input"
            value={values.timezone}
            onChange={(e) => set('timezone')(e.target.value)}
            aria-describedby="timezone-help"
          >
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </Field>
        <button className="sw-btn sw-btn--primary" type="submit" disabled={pending}>
          {pending ? 'Creating organization…' : 'Create organization'}
        </button>
        <p className="auth__switch">
          Already have an account? <Link to="/sign-in">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
