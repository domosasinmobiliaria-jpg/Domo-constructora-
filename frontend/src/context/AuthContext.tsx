import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

import { authApi, saveToken, getToken, clearToken, api } from '@/utils/api';

export type User = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'credit_advisor' | 'technical' | 'site_manager';
  status: 'pending' | 'approved' | 'rejected';
};

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    role: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User | null) => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = (await authApi.me()) as User;
      setUser(me);
    } catch {
      await clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Refresh de sesión al abrir la app.
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res: any = await authApi.login(email, password);
    await saveToken(res.access_token);
    setUser(res.user);
  }, []);

  const register = useCallback(async (payload: any) => {
    const res: any = await authApi.register(payload);
    // Solo el admin queda aprobado y con sesión activa.
    if (res.user?.status === 'approved') {
      await saveToken(res.access_token);
      setUser(res.user);
    }
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refresh, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
