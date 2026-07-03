import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ConcertDetail } from './ConcertDetail';
import { apiClient } from '../../api/client';
import { AuthProvider } from '../auth/AuthContext';

vi.mock('../../api/client', () => ({
  apiClient: {
    request: vi.fn(),
  },
}));

describe('ConcertDetail', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders concert details, ticket types, and reacts to selections', async () => {
    vi.spyOn(apiClient, 'request')
      .mockResolvedValueOnce({
        id: 'c1',
        title: 'Anh Trai Say Hi',
        location: 'Van Phuc City',
        startTime: '2026-06-30T19:30:00Z',
        description: 'Concert event desc.',
      })
      .mockResolvedValueOnce([
        { id: 't1', name: 'SVIP', price: 2000000, totalQuantity: 100, availableQuantity: 40, maxPerUser: 2 },
        { id: 't2', name: 'GA', price: 800000, totalQuantity: 500, availableQuantity: 100, maxPerUser: 4 },
      ])
      .mockResolvedValueOnce({ svgStageMap: '' });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/concerts/c1']}>
          <Routes>
            <Route path="/concerts/:id" element={<ConcertDetail />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Anh Trai Say Hi')).toBeInTheDocument();
      expect(screen.getByText('SVIP')).toBeInTheDocument();
      expect(screen.getByText('GA')).toBeInTheDocument();
    });

    // Select SVIP
    fireEvent.click(screen.getByText('SVIP'));
    expect(screen.getByText('Tổng tiền')).toBeInTheDocument();
    expect(screen.getAllByText(/2[.,]000[.,]000 VND/).length).toBeGreaterThan(0);
  });

  it('refreshes ticket inventory while the detail page stays open', async () => {
    let ticketTypeRequestCount = 0;
    let refreshInventory: (() => Promise<void>) | undefined;
    const realSetInterval = window.setInterval.bind(window);
    vi.spyOn(window, 'setInterval').mockImplementation((handler, timeout, ...args) => {
      if (timeout === 10000) {
        refreshInventory = handler as () => Promise<void>;
        return 123 as any;
      }
      return realSetInterval(handler, timeout, ...args);
    });
    vi.spyOn(window, 'clearInterval').mockImplementation(() => undefined);
    vi.spyOn(apiClient, 'request').mockImplementation(async (url) => {
      if (url === '/concerts/c1') {
        return {
          id: 'c1',
          title: 'Anh Trai Say Hi',
          location: 'Van Phuc City',
          startTime: '2026-06-30T19:30:00Z',
          description: 'Concert event desc.',
        };
      }
      if (url === '/concerts/c1/ticket-types') {
        ticketTypeRequestCount += 1;
        return [
          {
            id: 't1',
            name: 'GA',
            price: 800000,
            totalQuantity: 500,
            availableQuantity: ticketTypeRequestCount > 1 ? 88 : 100,
            maxPerUser: 4,
          },
        ];
      }
      if (url === '/concerts/c1/stagemap') {
        return { svgStageMap: '' };
      }
      return {};
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/concerts/c1']}>
          <Routes>
            <Route path="/concerts/:id" element={<ConcertDetail />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Còn 100 vé')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(refreshInventory).toBeTypeOf('function');
    });

    await act(async () => {
      await refreshInventory?.();
    });

    await waitFor(() => {
      expect(screen.getByText('Còn 88 vé')).toBeInTheDocument();
    });
  });

  it('selects a ticket type when the SVG zone id includes a suffix', async () => {
    vi.spyOn(apiClient, 'request')
      .mockResolvedValueOnce({
        id: 'c1',
        title: 'Anh Trai Say Hi',
        location: 'Van Phuc City',
        startTime: '2026-06-30T19:30:00Z',
        description: 'Concert event desc.',
      })
      .mockResolvedValueOnce([
        { id: 't1', name: 'SVIP', price: 2000000, totalQuantity: 100, availableQuantity: 40, maxPerUser: 2 },
      ])
      .mockResolvedValueOnce({ svgStageMap: '<svg><rect id="SVIP-01" width="100" height="60"></rect></svg>' });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/concerts/c1']}>
          <Routes>
            <Route path="/concerts/:id" element={<ConcertDetail />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(document.getElementById('SVIP-01')).not.toBeNull();
    });

    fireEvent.click(document.getElementById('SVIP-01')!);

    expect(screen.getByText('Tổng tiền')).toBeInTheDocument();
    expect(screen.getAllByText(/2[.,]000[.,]000 VND/).length).toBeGreaterThan(0);
  });

  it('shows booking creation errors beside the booking controls', async () => {
    localStorage.setItem('accessToken', 'token');
    localStorage.setItem('refreshToken', 'refresh');

    vi.spyOn(apiClient, 'request').mockImplementation(async (url, options) => {
      if (url === '/auth/me') {
        return { userId: 'u1', email: 'buyer@example.com', role: 'customer' };
      }
      if (url === '/concerts/c1') {
        return {
          id: 'c1',
          title: 'Anh Trai Say Hi',
          location: 'Van Phuc City',
          startTime: '2026-06-30T19:30:00Z',
          description: 'Concert event desc.',
        };
      }
      if (url === '/concerts/c1/ticket-types') {
        return [
          { id: 't1', name: 'SVIP', price: 2000000, totalQuantity: 100, availableQuantity: 40, maxPerUser: 2 },
        ];
      }
      if (url === '/concerts/c1/stagemap') {
        return { svgStageMap: '' };
      }
      if (url === '/bookings' && options?.method === 'POST') {
        throw new Error('Không thể tạo đơn đặt vé');
      }
      return {};
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/concerts/c1']}>
          <Routes>
            <Route path="/concerts/:id" element={<ConcertDetail />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.click(await screen.findByText('SVIP'));
    fireEvent.click(screen.getByRole('button', { name: /Đặt vé|Äáº·t vĂ©/i }));

    const bookingPanel = screen.getByTestId('booking-panel');
    await waitFor(() => {
      expect(bookingPanel).toHaveTextContent('Không thể tạo đơn đặt vé');
    });
  });
});
