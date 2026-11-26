import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { useDeleteRole, useRoles, useSaveRole } from '../api/hooks';
import type { Role } from '../api/types';
import { Dialog, Empty, ErrorPanel, Field, LoadingNote, Notice, SkeletonRows } from '../components/ui';
import { describedBy } from '../lib/forms';

function RoleDialog({ role, open, onClose, onSaved }: { role: Role | null; open: boolean; onClose: () => void; onSaved: (r: Role) => void }) {
  const save = useSaveRole();
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (save.isPending) return;
    if (!name.trim()) {
      setError('Enter a role name.');
      return;
    }
    try {
      const saved = await save.mutateAsync({ id: role?.id, name: name.trim(), description: description.trim() || null });
      onSaved(saved);
    } catch (e) {
      setError(e instanceof ApiError ? (e.fields.name ?? e.message) : 'Could not save the role.');
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={role ? 'Edit role' : 'New role'}>
      <form onSubmit={submit} noValidate>
        <Field id="role-name" label="Name" error={error}>
          <input
            id="role-name"
            className="sw-input"
            value={name}
            maxLength={80}
            placeholder="e.g. Barista"
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy('role-name', null, error)}
          />
        </Field>
        <Field id="role-description" label="Description" optional>
          <input
            id="role-description"
            className="sw-input"
            value={description}
            maxLength={500}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="form-actions">
          <button type="button" className="sw-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="sw-btn sw-btn--primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : role ? 'Save role' : 'Create role'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function Roles() {
  const roles = useRoles();
  const remove = useDeleteRole();
  const [editing, setEditing] = useState<{ role: Role | null } | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      setNotice(`${deleting.name} deleted`);
      setDeleting(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete the role.');
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="sw-page-title">Roles</h1>
          <p>Group people by the work they do, then assign tasks to the whole role.</p>
        </div>
        <button type="button" className="sw-btn sw-btn--primary" onClick={() => setEditing({ role: null })}>
          <Plus className="sw-icon" aria-hidden="true" />
          New role
        </button>
      </div>
      {notice && <Notice message={notice} onDismiss={() => setNotice(null)} />}
      {roles.isError && <ErrorPanel title="Couldn't load roles" error={roles.error} onRetry={() => roles.refetch()} />}

      <section className="sw-panel" aria-label="Roles">
        <div className="table-wrap">
          <table className="sw-table">
            <caption className="sw-visually-hidden">Roles with their people and tasks</caption>
            <thead>
              <tr>
                <th scope="col">Role</th>
                <th scope="col" className="sw-number">
                  People
                </th>
                <th scope="col" className="sw-number">
                  Tasks
                </th>
                <th scope="col">
                  <span className="sw-visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {roles.isPending && <SkeletonRows columns={4} rows={3} />}
              {roles.data?.map((role) => (
                <tr key={role.id}>
                  <th scope="row">
                    {role.name}
                    {role.description && <span className="sw-meta">{role.description}</span>}
                  </th>
                  <td className="sw-number" data-label="People">{role.member_count}</td>
                  <td className="sw-number" data-label="Tasks">{role.task_count}</td>
                  <td className="actions-cell">
                    <button type="button" className="sw-btn sw-btn--quiet" onClick={() => setEditing({ role })} aria-label={`Edit ${role.name}`}>
                      <Pencil className="sw-icon" aria-hidden="true" />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="sw-btn sw-btn--quiet"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleting(role);
                      }}
                      aria-label={`Delete ${role.name}`}
                    >
                      <Trash2 className="sw-icon" aria-hidden="true" />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {roles.isPending && <LoadingNote label="Loading roles" />}
        {roles.data?.length === 0 && (
          <Empty
            title="Create your first role"
            action={
              <button type="button" className="sw-btn sw-btn--primary" onClick={() => setEditing({ role: null })}>
                <Plus className="sw-icon" aria-hidden="true" />
                New role
              </button>
            }
          >
            For example Barista, Kitchen or Cleaning. People can have more than one role.
          </Empty>
        )}
      </section>

      {editing && (
        <RoleDialog
          key={editing.role?.id ?? 'new'}
          role={editing.role}
          open
          onClose={() => setEditing(null)}
          onSaved={(r) => {
            setEditing(null);
            setNotice(`${r.name} saved`);
          }}
        />
      )}

      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} title={`Delete ${deleting?.name ?? 'role'}?`}>
        <p className="dialog-text">
          {deleting?.member_count
            ? `${deleting.member_count} ${deleting.member_count === 1 ? 'person loses' : 'people lose'} this role. Their other roles stay.`
            : 'No one has this role.'}
        </p>
        {deleteError && (
          <p className="sw-error" role="alert">
            {deleteError}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="sw-btn" data-autofocus onClick={() => setDeleting(null)}>
            Cancel
          </button>
          <button type="button" className="sw-btn sw-btn--danger" onClick={confirmDelete} disabled={remove.isPending}>
            {remove.isPending ? 'Deleting…' : 'Delete role'}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
