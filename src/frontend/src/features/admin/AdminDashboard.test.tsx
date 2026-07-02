import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AdminDashboard } from './AdminDashboard';
import { apiClient } from '../../api/client';

vi.mock('../../api/client', () => ({
  apiClient: {
    request: vi.fn(),
  },
}));

describe('AdminDashboard', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('renders stats counters and recent events without unfinished analytics placeholder', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(async (url) => {
      if (url === '/concerts?page=1&limit=100') {
        return {
          concerts: [
            { id: '1', title: 'Em Xinh Say Hi', status: 'active', tags: [], location: 'Ho Chi Minh City', startTime: '2026-06-30T19:30:00Z' },
            { id: '2', title: 'Chị Đẹp Đạp Gió', status: 'draft', tags: [], location: 'Ha Noi', startTime: '2026-07-01T19:30:00Z' },
            { id: '3', title: 'Anh Trai Vượt Ngàn', status: 'active', tags: [], location: 'Da Nang', startTime: '2026-07-02T19:30:00Z' },
          ],
        };
      }

      return [];
    });

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    );

    expect(screen.queryByText('Tổng sự kiện')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Tổng sự kiện')).toBeInTheDocument();
      expect(screen.getByText('Đang bán')).toBeInTheDocument();
      expect(screen.getByText('Bản nháp')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('Sự kiện gần đây')).toBeInTheDocument();
      expect(screen.getAllByText('Em Xinh Say Hi').length).toBeGreaterThan(0);
      expect(screen.queryByText(/Revenue Analytics/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/backend stats API/i)).not.toBeInTheDocument();
    });
  });

  it('renders API error message gracefully on failure', async () => {
    vi.spyOn(apiClient, 'request').mockRejectedValue(new Error('Connection refused'));

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Connection refused')).toBeInTheDocument();
    });
  });

  it('summarizes ticket inventory from real ticket type endpoints', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(async (url) => {
      if (url === '/concerts?page=1&limit=100') {
        return {
          concerts: [
            { id: '1', title: 'Em Xinh Say Hi', status: 'active', tags: [], location: 'Ho Chi Minh City', startTime: '2026-06-30T19:30:00Z' },
            { id: '2', title: 'Chị Đẹp Đạp Gió', status: 'draft', tags: [], location: 'Ha Noi', startTime: '2026-07-01T19:30:00Z' },
          ],
        };
      }

      if (url === '/concerts/1/ticket-types') {
        return [
          { id: 'svip', name: 'SVIP', totalQuantity: 100, availableQuantity: 25, price: 3000000, maxPerUser: 2 },
          { id: 'ga', name: 'GA', totalQuantity: 400, availableQuantity: 300, price: 800000, maxPerUser: 4 },
        ];
      }

      if (url === '/concerts/2/ticket-types') {
        return [{ id: 'vip', name: 'VIP', totalQuantity: 200, availableQuantity: 200, price: 2000000, maxPerUser: 2 }];
      }

      return {};
    });

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Tổng vé phát hành')).toBeInTheDocument();
      expect(screen.getByText('700')).toBeInTheDocument();
      expect(screen.getByText('Đã bán/giữ')).toBeInTheDocument();
      expect(screen.getByText('175')).toBeInTheDocument();
      expect(screen.getByText('Tỷ lệ lấp đầy')).toBeInTheDocument();
      expect(screen.getByText('25%')).toBeInTheDocument();
      expect(screen.getByText('Tiến độ bán vé')).toBeInTheDocument();
      expect(screen.getAllByText('Em Xinh Say Hi').length).toBeGreaterThan(0);
      expect(screen.getByText('35%')).toBeInTheDocument();
      expect(screen.getByText('175 / 500 vé')).toBeInTheDocument();
    });
  });

  it('aggregates ticket data from available backend concert endpoints', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(async (url) => {
      if (url === '/concerts?page=1&limit=100') {
        return {
          concerts: [
            {
              id: '1',
              title: 'Fallback Show',
              status: 'active',
              tags: [],
              location: 'Ho Chi Minh City',
              startTime: '2026-06-30T19:30:00Z',
            },
          ],
        };
      }

      if (url === '/concerts/1/ticket-types') {
        return [{ id: 'ga', name: 'GA', totalQuantity: 120, availableQuantity: 20, price: 800000, maxPerUser: 4 }];
      }

      return {};
    });

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Fallback Show').length).toBeGreaterThan(0);
      expect(screen.getByText('120')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getAllByText('83%').length).toBeGreaterThan(0);
      expect(screen.getByText('Chưa có endpoint thống kê doanh thu.')).toBeInTheDocument();
    });
  });

  it('keeps dashboard usable when one concert ticket type request fails', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(async (url) => {
      if (url === '/concerts?page=1&limit=100') {
        return {
          concerts: [
            { id: '1', title: 'Healthy Show', status: 'active', tags: [], location: 'Ho Chi Minh City', startTime: '2026-06-30T19:30:00Z' },
            { id: '2', title: 'Partial Show', status: 'active', tags: [], location: 'Ha Noi', startTime: '2026-07-01T19:30:00Z' },
          ],
        };
      }

      if (url === '/concerts/1/ticket-types') {
        return [{ id: 'ga', name: 'GA', totalQuantity: 100, availableQuantity: 40, price: 800000, maxPerUser: 4 }];
      }

      if (url === '/concerts/2/ticket-types') {
        throw new Error('ticket types unavailable');
      }

      return {};
    });

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Healthy Show').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Partial Show').length).toBeGreaterThan(0);
      expect(screen.getByText('Không tải được hạng vé của 1 concert.')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('60')).toBeInTheDocument();
    });
  });
  it('does not request unavailable dashboard statistics and loads enough concerts for admin summaries', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(async (url) => {
      if (url === '/concerts?page=1&limit=100') {
        return {
          concerts: [
            {
              id: '1',
              title: 'Full Dashboard Show',
              status: 'active',
              tags: [],
              location: 'Ho Chi Minh City',
              startTime: '2026-06-30T19:30:00Z',
            },
          ],
        };
      }

      if (url === '/concerts/1/ticket-types') {
        return [{ id: 'ga', name: 'GA', totalQuantity: 120, availableQuantity: 20, price: 800000, maxPerUser: 4 }];
      }

      return {};
    });

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Full Dashboard Show').length).toBeGreaterThan(0);
      expect(screen.getByText('120')).toBeInTheDocument();
      expect(apiClient.request).toHaveBeenCalledWith('/concerts?page=1&limit=100');
    });

    expect(vi.mocked(apiClient.request).mock.calls.some(([url]) => url === '/admin/dashboard/statistics')).toBe(false);
  });
});
