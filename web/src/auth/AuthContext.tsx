import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SIGNED_OUT_EVENT, getToken, setToken } from '../api/client';
import { keys, useMe } from '../api/hooks';
import type { Me, Session } from '../api/types';

interface AuthValue {
  me: Me | null;
  loading: boolean;
  error: Error | null;
  retry: () => void;
  signIn: (session: Session) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [token, setTokenState] = useState(getToken);
  const query = useMe(token !== null);

  const signOut = useCallback(() => {
    setToken(null);
    setTokenState(null);
    client.clear();
  }, [client]);

  const signIn = useCallback(
    (session: Session) => {
      client.clear();
      setToken(session.access_token);
      client.setQueryData(keys.me, { user: session.user, organization: session.organization });
      setTokenState(session.access_token);
    },
    [client],
  );

  useEffect(() => {
    window.addEventListener(SIGNED_OUT_EVENT, signOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, signOut);
  }, [signOut]);

  const value = useMemo<AuthValue>(
    () => ({
      me: token ? (query.data ?? null) : null,
      loading: token !== null && query.isPending,
      error: token ? query.error : null,
      retry: () => void query.refetch(),
      signIn,
      signOut,
    }),
    [token, query, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

/** The signed-in manager. Only call inside the protected app shell. */
export function useMeRequired(): Me {
  const { me } = useAuth();
  if (!me) throw new Error('Not signed in');
  return me;
}
