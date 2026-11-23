import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setApiToken, setUnauthorizedHandler } from './api';
import { loadToken, saveToken } from './storage';
import type { Me, Session } from './types';

interface AuthValue {
  ready: boolean;
  me: Me | null;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  const signOut = useCallback(async () => {
    setApiToken(null);
    setMe(null);
    client.clear();
    await saveToken(null);
  }, [client]);

  const refresh = useCallback(async () => {
    setMe(await api<Me>('/auth/me'));
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void signOut());
    let cancelled = false;
    (async () => {
      const token = await loadToken();
      if (token) {
        setApiToken(token);
        try {
          const current = await api<Me>('/auth/me');
          if (!cancelled) setMe(current);
        } catch {
          // Offline or expired: show sign-in; an expired token is cleared by the 401 handler.
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
      setUnauthorizedHandler(null);
    };
  }, [signOut]);

  const signIn = useCallback(
    async (identifier: string, password: string) => {
      const session = await api<Session>('/auth/login', { method: 'POST', body: { identifier: identifier.trim(), password } });
      client.clear();
      setApiToken(session.access_token);
      await saveToken(session.access_token);
      setMe({ user: session.user, organization: session.organization });
    },
    [client],
  );

  const value = useMemo(() => ({ ready, me, signIn, signOut, refresh }), [ready, me, signIn, signOut, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

export function useMe(): Me {
  const { me } = useAuth();
  if (!me) throw new Error('Not signed in');
  return me;
}
