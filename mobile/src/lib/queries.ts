import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { DayOut, MemberReport, Occurrence } from './types';

export function useDay(day: string | null) {
  return useQuery({
    queryKey: ['my-day', day],
    queryFn: () => api<DayOut>('/me/day', { query: { day } }),
    refetchInterval: 60_000,
  });
}

export function useMyReport(start: string | null, end: string | null) {
  return useQuery({
    queryKey: ['my-report', start, end],
    queryFn: () => api<MemberReport>('/me/report', { query: { start, end } }),
    enabled: Boolean(start && end),
  });
}

function useRefreshMine() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['my-day'] }),
      client.invalidateQueries({ queryKey: ['my-report'] }),
    ]);
}

export function useComplete() {
  const refresh = useRefreshMine();
  return useMutation({
    mutationFn: (body: { task_id: number; period_date: string; note?: string | null }) =>
      api<Occurrence>('/me/completions', { method: 'POST', body }),
    onSettled: refresh,
  });
}

export function useUndo() {
  const refresh = useRefreshMine();
  return useMutation({
    mutationFn: (completionId: number) => api<Occurrence>(`/me/completions/${completionId}`, { method: 'DELETE' }),
    onSettled: refresh,
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { current_password: string; new_password: string }) =>
      api<void>('/auth/change-password', { method: 'POST', body }),
  });
}
