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
        screen.getAllByRole('link', { name: /concerts/i }).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getByRole('link', { name: /login/i }),
      ).toBeInTheDocument();
    });
  });

  it('uses the entered demo account details after login', async () => {
    window.history.pushState({}, '', '/login');
    vi.spyOn(apiClient, 'request').mockResolvedValue({ data: { concerts: [] } });

    render(<App />);

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Nguyen Van A' },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'a@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/role/i), {
      target: { value: 'audience' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^login$/i }));

    await waitFor(() => {
      expect(screen.getByText('Nguyen Van A')).toBeInTheDocument();
    });
  });
});
