import React, { useCallback, useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { AuthContext, type User } from './AuthContextValue';

interface CurrentUserResponse {
  userId: string;
  email: string;
  role: User['role'];
  fullName?: string;
}

const normalizeUser = (userData: CurrentUserResponse): User => {
  return {
    id: userData.userId,
    email: userData.email,
    fullName: userData.fullName,
    role: userData.role,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('accessToken')));

  const clearLocalSession = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        await apiClient.request('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // Local cleanup still has to happen if the server already expired the session.
      }
    }

    clearLocalSession();
  }, [clearLocalSession]);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const userData = await apiClient.request<CurrentUserResponse>('/auth/me');
      setUser(normalizeUser(userData));
    } catch {
      await logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');
    let bootstrapTimer: number | undefined;
    if (accessToken) {
      bootstrapTimer = window.setTimeout(() => {
        void fetchCurrentUser();
      }, 0);
    }

    const handleLogoutEvent = () => {
      void logout();
    };

    window.addEventListener('auth-logout', handleLogoutEvent);
    return () => {
      if (bootstrapTimer !== undefined) {
        window.clearTimeout(bootstrapTimer);
      }
      window.removeEventListener('auth-logout', handleLogoutEvent);
    };
  }, [fetchCurrentUser, logout]);

  const login = async (accessToken: string, refreshToken: string) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);

    setLoading(true);
    await fetchCurrentUser();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

