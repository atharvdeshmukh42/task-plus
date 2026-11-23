// Mirrors backend/app/schemas.py.

export type AccessLevel = 'owner' | 'supervisor' | 'employee';
export type Recurrence = 'once' | 'daily' | 'weekly' | 'specific_days';
export type Status = 'upcoming' | 'pending' | 'overdue' | 'done' | 'late' | 'missed';
export type Scope = 'day' | 'week' | 'once';

export interface RoleRef {
  id: number;
  name: string;
}

export interface PersonRef {
  id: number;
  full_name: string;
}

export interface Organization {
  id: number;
  name: string;
  timezone: string;
}

export interface User {
  id: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  access_level: AccessLevel;
  is_active: boolean;
  roles: RoleRef[];
  created_at: string;
}

export interface Session {
  access_token: string;
  user: User;
  organization: Organization;
}

export interface Me {
  user: User;
  organization: Organization;
}

export interface Role {
  id: number;
  name: string;
  description: string | null;
  member_count: number;
  task_count: number;
}

export interface TaskSchedule {
  recurrence: Recurrence;
  days_of_week: number[] | null;
  due_date: string | null;
  start_time: string | null;
  end_time: string | null;
}

export interface Task extends TaskSchedule {
  id: number;
  title: string;
  description: string | null;
  role_id: number | null;
  assignee_id: number | null;
  role: RoleRef | null;
  assignee: PersonRef | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskInput {
  title: string;
  description: string | null;
  role_id: number | null;
  assignee_id: number | null;
  recurrence: Recurrence;
  days_of_week: number[] | null;
  due_date: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
}

export interface TaskBrief extends TaskSchedule {
  id: number;
  title: string;
  description: string | null;
  role: RoleRef | null;
  assignee: PersonRef | null;
}

export interface Completion {
  id: number;
  completed_at: string;
  is_late: boolean;
  note: string | null;
}

export interface Occurrence {
  task: TaskBrief;
  scope: Scope;
  period_date: string;
  due_date: string | null;
  status: Status;
  can_complete: boolean;
  completion: Completion | null;
  report_date: string | null;
}

export interface Tally {
  total: number;
  done: number;
  late: number;
  missed: number;
  open: number;
  completion_rate: number | null;
  on_time_rate: number | null;
}

export interface MemberBrief {
  id: number;
  full_name: string;
  access_level: AccessLevel;
  roles: RoleRef[];
}

export interface Board {
  date: string;
  today: string;
  timezone: string;
  summary: Tally;
  members: { member: MemberBrief; summary: Tally; occurrences: Occurrence[] }[];
}

export interface DayTally {
  date: string;
  total: number;
  done: number;
  late: number;
  missed: number;
  open: number;
}

export interface TaskTally {
  task: TaskBrief;
  summary: Tally;
}

export interface MemberReport {
  member: MemberBrief;
  start: string;
  end: string;
  today: string;
  summary: Tally;
  days: DayTally[];
  tasks: TaskTally[];
  history: Occurrence[];
}

export interface TeamReport {
  start: string;
  end: string;
  today: string;
  summary: Tally;
  days: DayTally[];
  members: { member: MemberBrief; summary: Tally }[];
  tasks: TaskTally[];
}
