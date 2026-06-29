import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute, AdminRoute } from './RouteGuards';
import { useAuth } from '../features/auth/AuthContext';

vi.mock('../features/auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('Route Guards', () => {
  it('redirects ProtectedRoute to login if not authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      login: async () => {},
      logout: () => {},
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={<ProtectedRoute><div>Secret Content</div></ProtectedRoute>} />
          <Route path="/login" element={<div>Login Screen</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Screen')).toBeInTheDocument();
    expect(screen.queryByText('Secret Content')).not.toBeInTheDocument();
  });

  it('renders ProtectedRoute content if authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '1', email: 'a@a.com', fullName: 'John Doe', role: 'audience' },
      loading: false,
      login: async () => {},
      logout: () => {},
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={<ProtectedRoute><div>Secret Content</div></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Secret Content')).toBeInTheDocument();
  });

  it('redirects AdminRoute to unauthorized if user is not organizer', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '1', email: 'a@a.com', fullName: 'John Doe', role: 'audience' },
      loading: false,
      login: async () => {},
      logout: () => {},
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminRoute><div>Admin Controls</div></AdminRoute>} />
          <Route path="/unauthorized" element={<div>Access Denied</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('renders AdminRoute content for organizer demo users', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'demo-organizer', email: 'demo@example.com', fullName: 'Demo Organizer', role: 'organizer' },
      loading: false,
      login: async () => {},
      logout: () => {},
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminRoute><div>Admin Controls</div></AdminRoute>} />
          <Route path="/unauthorized" element={<div>Access Denied</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Admin Controls')).toBeInTheDocument();
  });
});
