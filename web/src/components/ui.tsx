import { CircleAlert, CircleCheck, CircleX, Clock3, Info, RotateCw } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import type { Status } from '../api/types';

/* ---------- Status ---------- */

const STATUS: Record<Status, { label: string; tone: string; Icon: typeof Clock3 }> = {
  upcoming: { label: 'Upcoming', tone: 'info', Icon: Info },
  pending: { label: 'To do', tone: '', Icon: Clock3 },
  overdue: { label: 'Overdue', tone: 'warning', Icon: CircleAlert },
  done: { label: 'Done', tone: 'success', Icon: CircleCheck },
  late: { label: 'Done late', tone: 'warning', Icon: CircleCheck },
  missed: { label: 'Missed', tone: 'danger', Icon: CircleX },
};

export function StatusBadge({ status }: { status: Status }) {
  const { label, tone, Icon } = STATUS[status];
  return (
    <span className={`sw-status${tone ? ` sw-status--${tone}` : ''}`}>
      <Icon className="sw-icon" aria-hidden="true" />
      {label}
    </span>
  );
}

export function Badge({ tone, icon, children }: { tone?: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={`sw-status${tone ? ` sw-status--${tone}` : ''}`}>
      {icon}
      {children}
    </span>
  );
}

/* ---------- Fields ---------- */

export function Field({
  id,
  label,
  optional,
  help,
  error,
  children,
}: {
  id: string;
  label: ReactNode;
  optional?: boolean;
  help?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="form-field">
      <label className="sw-label" htmlFor={id}>
        {label}
        {optional && <span className="optional">Optional</span>}
      </label>
      {children}
      {help && (
        <p id={`${id}-help`} className="field-help sw-meta">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="sw-error">
          {error}
        </p>
      )}
    </div>
  );
}

/* ---------- Dialog ---------- */

/** A modal dialog. `sheet` docks it to the bottom of the screen and also closes it on a backdrop tap. */
export function Dialog({
  open,
  onClose,
  title,
  wide,
  sheet,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  wide?: boolean;
  sheet?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const headingId = useId();

  // Dialogs that unmount as they close never fire `close`, so restore focus on unmount too.
  useEffect(
    () => () => {
      const target = returnFocus.current;
      if (target?.isConnected) requestAnimationFrame(() => target.focus());
    },
    [],
  );

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      const first = dialog.querySelector<HTMLElement>('[data-autofocus], input:not([type=hidden]), select, textarea');
      first?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`sw-dialog${wide ? ' sw-dialog--wide' : ''}${sheet ? ' sw-dialog--sheet' : ''}`}
      aria-labelledby={headingId}
      onClick={(event) => {
        // A click on the dialog element itself outside its box is a click on the backdrop.
        if (!sheet || event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
        if (!inside) onClose();
      }}
      onClose={() => {
        onClose();
        returnFocus.current?.focus();
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {open && (
        <>
          <h2 id={headingId} className="sw-section-title">
            {title}
          </h2>
          {children}
        </>
      )}
    </dialog>
  );
}

/* ---------- Loading, empty, error ---------- */

export function SkeletonRows({ columns, rows = 4 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="skeleton-row" aria-hidden="true">
          {Array.from({ length: columns }, (_, c) => (
            <td key={c}>
              <span className="skeleton" style={{ width: `${c === 0 ? 70 : 40 + ((r + c) % 3) * 15}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function LoadingNote({ label }: { label: string }) {
  return (
    <p role="status" className="sw-visually-hidden">
      {label}
    </p>
  );
}

export function ErrorPanel({ title, error, onRetry }: { title: string; error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <div className="error-panel" role="alert">
      <CircleAlert aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      {onRetry && (
        <button type="button" className="sw-btn" onClick={onRetry}>
          <RotateCw className="sw-icon" aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <strong className="sw-subheading">{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/* ---------- Notice ---------- */

export function Notice({
  message,
  tone = 'success',
  action,
  onDismiss,
}: {
  message: string;
  tone?: 'success' | 'info' | 'warning';
  action?: ReactNode;
  onDismiss?: () => void;
}) {
  const Icon = tone === 'success' ? CircleCheck : tone === 'warning' ? CircleAlert : Info;
  return (
    <div className={`notice${tone === 'success' ? '' : ` notice--${tone}`}`} role="status">
      <Icon aria-hidden="true" />
      <span>{message}</span>
      {action}
      {onDismiss && !action && (
        <button type="button" className="sw-btn sw-btn--quiet" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  );
}
