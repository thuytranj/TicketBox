import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { AuthProvider } from '../../../features/auth/AuthContext';
import { useAuth } from '../../../features/auth/useAuth';
import { apiClient } from '../../../api/client';

vi.mock('../../../api/client', () => ({
  apiClient: {
    request: vi.fn(),
  },
}));

const TestComponent = () => {
  const { user, loading, logout } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Guest</div>;
  return (
    <div>
      <span>User: {user.fullName || user.email} ({user.role})</span>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders guest state initially when no tokens are found', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Should resolve to Guest since no token exists in localStorage
    await waitFor(() => {
      expect(screen.getByText('Guest')).toBeInTheDocument();
    });
  });

  it('fetches current user details if token is in localStorage', async () => {
    localStorage.setItem('accessToken', 'token');
    const mockRequest = vi.spyOn(apiClient, 'request').mockResolvedValue({
      userId: '1',
      email: 'a@a.com',
      role: 'organizer',
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('User: a@a.com (organizer)')).toBeInTheDocument();
    });
    expect(mockRequest).toHaveBeenCalledWith('/auth/me');
  });
});
