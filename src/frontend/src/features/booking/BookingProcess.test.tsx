import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { BookingProcess } from './BookingProcess';
import { apiClient } from '../../api/client';

vi.mock('../../api/client', () => ({
  apiClient: {
    request: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('BookingProcess', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading status initially and shows spinner', async () => {
    vi.spyOn(apiClient, 'request').mockReturnValue(new Promise(() => {})); // pending request

    render(
      <MemoryRouter initialEntries={['/bookings/processing/order123']}>
        <Routes>
          <Route path="/bookings/processing/:orderId" element={<BookingProcess />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Holding your tickets. Please wait a moment...')).toBeInTheDocument();
  });

  it('polls and redirects to checkout screen when status is pending', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue({
      id: 'order123',
      status: 'pending',
      totalAmount: 500000,
      createdAt: '2026-06-30T19:30:00Z',
    });

    render(
      <MemoryRouter initialEntries={['/bookings/processing/order123']}>
        <Routes>
          <Route path="/bookings/processing/:orderId" element={<BookingProcess />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/checkout/order123');
    });
  });

  it('displays expired message if booking status is expired', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue({
      id: 'order123',
      status: 'expired',
      totalAmount: 500000,
      createdAt: '2026-06-30T19:30:00Z',
    });

    render(
      <MemoryRouter initialEntries={['/bookings/processing/order123']}>
        <Routes>
          <Route path="/bookings/processing/:orderId" element={<BookingProcess />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Booking Expired or Cancelled')).toBeInTheDocument();
    });
  });

  it('displays error message if the API request fails', async () => {
    vi.spyOn(apiClient, 'request').mockRejectedValue(new Error('Database lock timeout'));

    render(
      <MemoryRouter initialEntries={['/bookings/processing/order123']}>
        <Routes>
          <Route path="/bookings/processing/:orderId" element={<BookingProcess />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to Secure Tickets')).toBeInTheDocument();
      expect(screen.getByText('Database lock timeout')).toBeInTheDocument();
    });
  });
});
