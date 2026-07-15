import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import App from '../App';
import { apiClient } from '../api/client';

vi.mock('../api/client', () => ({
  apiClient: {
    request: vi.fn(),
  },
}));

const mockApiRequest = vi.mocked(apiClient.request);

describe('TicketBox app routing', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, '', '/');
    vi.restoreAllMocks();
  });

  it('renders landing page containing the header navigation', async () => {
    mockApiRequest.mockResolvedValue({ data: [] });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /ticketbox/i })).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: /sự kiện/i }).length).toBeGreaterThan(0);
      expect(screen.getByRole('link', { name: /đăng nhập/i })).toBeInTheDocument();
    });
  });

  it('does not prefill the login form with example account details', async () => {
    window.history.pushState({}, '', '/login');
    mockApiRequest.mockResolvedValue({ data: { concerts: [] } });

    render(<App />);

    expect(await screen.findByLabelText(/email/i)).toHaveValue('');
    expect(screen.getByLabelText(/mật khẩu/i)).toHaveValue('');
    expect(screen.queryByDisplayValue('John Organizer')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('organizer@ticketboxz.me')).not.toBeInTheDocument();
  });

  it('logs in with the real auth API and shows the current account', async () => {
    window.history.pushState({}, '', '/login');
    mockApiRequest.mockImplementation(async (path) => {
      if (path === '/auth/login') {
        return { accessToken: 'access-token', refreshToken: 'refresh-token' };
      }
      if (path === '/auth/me') {
        return { userId: 'user-1', email: 'a@example.com', role: 'audience' };
      }
      return { data: { concerts: [] } };
    });

    render(<App />);

    fireEvent.change(await screen.findByLabelText(/email/i), {
      target: { value: 'a@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/mật khẩu/i), {
      target: { value: 'password123' },
    });
    fireEvent.submit(screen.getByLabelText(/email/i).closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        '/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'a@example.com', password: 'password123' }),
        }),
      );
      expect(screen.getByText('a@example.com')).toBeInTheDocument();
    });
  });

  it('shows an unauthorized page when a non-organizer opens admin', async () => {
    window.history.pushState({}, '', '/admin');
    localStorage.setItem('accessToken', 'access-token');
    localStorage.setItem('refreshToken', 'refresh-token');
    mockApiRequest.mockImplementation(async (path) => {
      if (path === '/auth/me') {
        return { userId: 'user-1', email: 'audience@example.com', role: 'audience' };
      }
      return { data: { concerts: [] } };
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: /không có quyền truy cập/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /đổi tài khoản/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /về trang sự kiện/i })).toBeInTheDocument();
  });
});
