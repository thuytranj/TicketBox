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
  const refreshTimerRef = React.useRef<NodeJS.Timeout | number | null>(null);

  const scheduleTokenRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current as any);
      refreshTimerRef.current = null;
    }

    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) return;

    try {
      const parts = accessToken.split('.');
      if (parts.length !== 3) return;
      const payload = JSON.parse(atob(parts[1]));
      const exp = payload.exp * 1000;
      
      // Đặt lịch làm mới trước 1 phút (60 giây) trước khi token hết hạn
      const delay = exp - Date.now() - 60000;
      
      if (delay > 0) {
        refreshTimerRef.current = setTimeout(async () => {
          try {
            await apiClient.handleTokenRefresh();
          } catch (err) {
            console.error('Auto-refresh token failed:', err);
          }
        }, delay) as any;
      } else {
        // Nếu token đã hết hạn hoặc cực kỳ gần hết hạn, chạy refresh ngay lập tức
        void apiClient.handleTokenRefresh().catch(() => {});
      }
    } catch {
      // Bỏ qua lỗi format token
    }
  }, []);

  const clearLocalSession = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current as any);
      refreshTimerRef.current = null;
    }
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

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'accessToken') {
        if (e.newValue) {
          // Token được cập nhật từ tab khác -> đặt lại lịch và lấy lại user info
          scheduleTokenRefresh();
          void fetchCurrentUser();
        } else {
          // Token bị xóa ở tab khác -> tự động logout theo
          void logout();
        }
      }
    };

    const handleTokenRefreshed = () => {
      scheduleTokenRefresh();
    };

    window.addEventListener('auth-logout', handleLogoutEvent);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-token-refreshed', handleTokenRefreshed);

    // Bắt đầu lập lịch hẹn giờ
    scheduleTokenRefresh();

    return () => {
      if (bootstrapTimer !== undefined) {
        window.clearTimeout(bootstrapTimer);
      }
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current as any);
      }
      window.removeEventListener('auth-logout', handleLogoutEvent);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-token-refreshed', handleTokenRefreshed);
    };
  }, [fetchCurrentUser, logout, scheduleTokenRefresh]);

  const login = async (accessToken: string, refreshToken: string) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);

    scheduleTokenRefresh();
    setLoading(true);
    await fetchCurrentUser();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

