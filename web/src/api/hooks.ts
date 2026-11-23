import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { Board, Me, MemberReport, Organization, Role, Task, TaskInput, TeamReport, User } from './types';

export const keys = {
  me: ['me'] as const,
  roles: ['roles'] as const,
  members: (filters: object) => ['members', filters] as const,
  tasks: (filters: object) => ['tasks', filters] as const,
  task: (id: number) => ['task', id] as const,
  board: (day: string | null, roleId: number | null) => ['board', day, roleId] as const,
  team: (start: string, end: string, roleId: number | null) => ['team-report', start, end, roleId] as const,
  member: (id: number, start: string, end: string) => ['member-report', id, start, end] as const,
};

/** Data that changes whenever people, roles or tasks change. */
function useInvalidateAll() {
  const client = useQueryClient();
  return () =>
    Promise.all(
      ['roles', 'members', 'tasks', 'task', 'board', 'team-report', 'member-report'].map((key) =>
        client.invalidateQueries({ queryKey: [key] }),
      ),
    );
}

export function useMe(enabled: boolean) {
  return useQuery({ queryKey: keys.me, queryFn: () => api<Me>('/auth/me'), enabled, retry: false });
}

export function useRoles() {
  return useQuery({ queryKey: keys.roles, queryFn: () => api<Role[]>('/roles') });
}

export function useMembers(filters: { include_inactive?: boolean } = {}) {
  return useQuery({ queryKey: keys.members(filters), queryFn: () => api<User[]>('/members', { query: filters }) });
}

export function useTasks() {
  return useQuery({ queryKey: keys.tasks({}), queryFn: () => api<Task[]>('/tasks') });
}

export function useTask(id: number | null) {
  return useQuery({
    queryKey: keys.task(id ?? 0),
    queryFn: () => api<Task>(`/tasks/${id}`),
    enabled: id !== null,
  });
}

export function useBoard(day: string | null, roleId: number | null) {
  return useQuery({
    queryKey: keys.board(day, roleId),
    queryFn: () => api<Board>('/board', { query: { day, role_id: roleId } }),
    refetchInterval: 60_000,
  });
}

export function useTeamReport(start: string, end: string, roleId: number | null) {
  return useQuery({
    queryKey: keys.team(start, end, roleId),
    queryFn: () => api<TeamReport>('/reports/team', { query: { start, end, role_id: roleId } }),
    enabled: Boolean(start && end),
  });
}

export function useMemberReport(id: number, start: string, end: string) {
  return useQuery({
    queryKey: keys.member(id, start, end),
    queryFn: () => api<MemberReport>(`/reports/members/${id}`, { query: { start, end } }),
    enabled: Boolean(start && end),
  });
}

export function useSaveRole() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, ...body }: { id?: number; name: string; description: string | null }) =>
      id ? api<Role>(`/roles/${id}`, { method: 'PATCH', body }) : api<Role>('/roles', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useDeleteRole() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/roles/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export interface MemberInput {
  full_name: string;
  email: string | null;
  phone: string | null;
  password?: string;
  access_level?: 'employee' | 'supervisor';
  role_ids: number[];
  is_active?: boolean;
}

export function useSaveMember() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, ...body }: MemberInput & { id?: number }) =>
      id ? api<User>(`/members/${id}`, { method: 'PATCH', body }) : api<User>('/members', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useSaveTask() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: TaskInput }) =>
      id ? api<Task>(`/tasks/${id}`, { method: 'PUT', body }) : api<Task>('/tasks', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useSetTaskActive() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      api<Task>(`/tasks/${id}`, { method: 'PATCH', body: { is_active } }),
    onSuccess: invalidate,
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useUpdateOrganization() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; timezone: string }) =>
      api<Organization>('/organization', { method: 'PATCH', body }),
    onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: keys.me }), client.invalidateQueries()]),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { current_password: string; new_password: string }) =>
      api<void>('/auth/change-password', { method: 'POST', body }),
  });
}
