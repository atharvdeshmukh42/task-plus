const TOKEN_KEY = 'taskplus.token';
const BASE = import.meta.env.VITE_API_URL ?? '';

export const SIGNED_OUT_EVENT = 'taskplus:signed-out';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private mode: the session lasts until reload.
  }
}

export class ApiError extends Error {
  status: number;
  fields: Record<string, string>;

  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

type ValidationItem = { loc?: (string | number)[]; msg?: string };

function readError(status: number, body: unknown): ApiError {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return new ApiError(status, detail);
  if (Array.isArray(detail)) {
    const fields: Record<string, string> = {};
    let first = '';
    for (const item of detail as ValidationItem[]) {
      const message = (item.msg ?? 'Check this value.').replace(/^Value error, /, '');
      const field = item.loc && item.loc.length > 1 ? String(item.loc[item.loc.length - 1]) : '';
      if (field && field !== 'body' && !fields[field]) fields[field] = message;
      if (!first) first = message;
    }
    return new ApiError(status, first || 'Check the highlighted fields.', fields);
  }
  if (status >= 500) return new ApiError(status, 'The server ran into a problem. Try again in a moment.');
  return new ApiError(status, 'Something went wrong. Try again.');
}

type Query = Record<string, string | number | boolean | null | undefined>;

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Query } = {},
): Promise<T> {
  const url = new URL(`${BASE}/api${path}`, window.location.origin);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the Task Plus server. Check your connection and try again.");
  }

  if (response.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
  }
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok) throw readError(response.status, body);
  return body as T;
}
