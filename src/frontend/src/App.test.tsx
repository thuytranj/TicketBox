import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import App from './App';
import { apiClient } from './api/client';

vi.mock('./api/client', () => ({
  apiClient: {
    request: vi.fn(),
  },
}));

describe('TicketBox app routing', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, '', '/');
    vi.restoreAllMocks();
  });

  it('renders landing page containing the header navigation', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue({ data: [] });

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('link', { name: /ticketbox/i }),
      ).toBeInTheDocument();
      expect(
        screen.getAllByRole('link', { name: /sự kiện/i }).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getByRole('link', { name: /đăng nhập/i }),
      ).toBeInTheDocument();
    });
  });

  it('does not prefill the login form with example account details', async () => {
    window.history.pushState({}, '', '/login');
    vi.spyOn(apiClient, 'request').mockResolvedValue({ data: { concerts: [] } });

    render(<App />);

    expect(await screen.findByLabelText(/họ và tên/i)).toHaveValue('');
    expect(screen.getByLabelText(/email/i)).toHaveValue('');
    expect(screen.queryByDisplayValue('John Organizer')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('organizer@ticketboxz.me')).not.toBeInTheDocument();
  });

  it('uses the entered demo account details after login', async () => {
    window.history.pushState({}, '', '/login');
    vi.spyOn(apiClient, 'request').mockResolvedValue({ data: { concerts: [] } });

    render(<App />);

    fireEvent.change(await screen.findByLabelText(/họ và tên/i), {
      target: { value: 'Nguyen Van A' },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'a@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/vai trò/i), {
      target: { value: 'audience' },
    });
    fireEvent.click(screen.getByRole('button', { name: /vào ticketbox/i }));

    await waitFor(() => {
      expect(screen.getByText('Nguyen Van A')).toBeInTheDocument();
    });
  });

  it('shows an unauthorized page when a non-organizer opens admin', async () => {
    window.history.pushState({}, '', '/admin');
    localStorage.setItem('accessToken', 'mock-access-token');
    localStorage.setItem('refreshToken', 'mock-refresh-token');
    localStorage.setItem(
      'demoUser',
      JSON.stringify({
        id: 'demo-audience',
        email: 'audience@example.com',
        fullName: 'Audience User',
        role: 'audience',
      })
    );
    vi.spyOn(apiClient, 'request').mockResolvedValue({ data: { concerts: [] } });

    render(<App />);

    expect(await screen.findByRole('heading', { name: /Không có quyền truy cập/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Đổi tài khoản/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Về trang sự kiện/i })).toBeInTheDocument();
  });
});
