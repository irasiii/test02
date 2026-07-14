import { useEffect, useState } from 'react';
import { api, setToken } from '@/lib/api';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('geny.admin.token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((u) => {
        if (u.role === 'ADMIN') setUser(u);
        else {
          setToken(null);
        }
      })
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(identifier: string, password: string) {
    const r = await api.login(identifier, password);
    setToken(r.accessToken);
    if (r.user.role !== 'ADMIN') {
      setToken(null);
      throw new Error('Only admin accounts can access the dashboard');
    }
    setUser(r.user);
    return r.user;
  }

  function logout() {
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  }

  return { user, loading, login, logout };
}
