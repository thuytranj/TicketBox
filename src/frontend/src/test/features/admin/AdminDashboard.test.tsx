import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AdminDashboard } from '../../../features/admin/AdminDashboard';
import { apiClient } from '../../../api/client';

vi.mock('../../../api/client', () => ({
  apiClient: {
    request: vi.fn(),
  },
}));

const overview = {
  concerts: {
    total: 3,
    active: 2,
    draft: 1,
    cancelled: 0,
  },
  orders: {
    total: 125,
    paid: 98,
    pending: 10,
    expired: 15,
    cancelled: 2,
  },
  revenue: {
    totalRevenue: 245000000,
    averageOrderValue: 2500000,
  },
  tickets: {
    totalIssued: 700,
    totalSold: 175,
    paidTickets: 175,
    reservedTickets: 10,
    availableTickets: 515,
    fillRate: 25,
  },
  checkins: {
    totalCheckins: 90,
    checkinRate: 51.43,
  },
};

const revenueSeries = {
  period: 'day' as const,
  from: '2026-06-03T00:00:00.000Z',
  to: '2026-07-03T00:00:00.000Z',
  data: [
    { date: '2026-06-15T00:00:00.000Z', revenue: 150000000, orderCount: 45 },
    { date: '2026-06-16T00:00:00.000Z', revenue: 95000000, orderCount: 32 },
  ],
};

const concerts = [
  {
    id: '1',
    title: 'Em Xinh Say Hi',
    description: '',
    posterUrl: '',
    status: 'active' as const,
    tags: [],
    location: 'Ho Chi Minh City',
    startTime: '2026-06-30T19:30:00Z',
  },
  {
    id: '2',
    title: 'Chi Dep Dap Gio',
    description: '',
    posterUrl: '',
    status: 'cancelled' as const,
    tags: [],
    location: 'Ha Noi',
    startTime: '2026-07-01T19:30:00Z',
  },
];

const concertOneStats = {
  concert: {
    id: '1',
    title: 'Em Xinh Say Hi',
    status: 'active' as const,
    startTime: '2026-06-30T19:30:00Z',
  },
  revenue: {
    totalRevenue: 210000000,
    paidOrderCount: 70,
  },
  ticketTypes: [
    {
      name: 'SVIP',
      price: 3000000,
      totalQuantity: 100,
      availableQuantity: 100,
      soldQuantity: 70,
      paidQuantity: 70,
      reservedQuantity: 5,
      revenue: 210000000,
    },
    {
      name: 'GA',
      price: 800000,
      totalQuantity: 400,
      availableQuantity: 400,
      soldQuantity: 100,
      paidQuantity: 100,
      reservedQuantity: 0,
      revenue: 80000000,
    },
  ],
  checkins: {
    ticketCheckins: 60,
    vipGuestCheckins: 5,
    totalCheckins: 65,
  },
};

const concertTwoStats = {
  concert: {
    id: '2',
    title: 'Chi Dep Dap Gio',
    status: 'cancelled' as const,
    startTime: '2026-07-01T19:30:00Z',
  },
  revenue: {
    totalRevenue: 0,
    paidOrderCount: 0,
  },
  ticketTypes: [
    {
      name: 'VIP',
      price: 2000000,
      totalQuantity: 200,
      availableQuantity: 200,
      soldQuantity: 0,
      paidQuantity: 0,
      reservedQuantity: 0,
      revenue: 0,
    },
  ],
  checkins: {
    ticketCheckins: 0,
    vipGuestCheckins: 0,
    totalCheckins: 0,
  },
};

const mockDashboardApi = () => {
  vi.spyOn(apiClient, 'request').mockImplementation(async (url) => {
    if (url === '/statistics/overview') return overview;
    if (url === '/statistics/revenue?period=day') return revenueSeries;
    if (String(url).startsWith('/concerts')) {
      const statusParam = new URLSearchParams(String(url).split('?')[1] || '').get('status');
      if (statusParam) {
        return { concerts: concerts.filter((c) => c.status === statusParam) };
      }
      return { concerts };
    }
    if (url === '/statistics/concerts/1') return concertOneStats;
    if (url === '/statistics/concerts/2') return concertTwoStats;

    return {};
  });
};

describe('AdminDashboard', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('renders overview counters from the Statistics API', async () => {
    mockDashboardApi();

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    );

    expect(screen.queryByText('Tổng sự kiện')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getAllByText(/Tổng sự kiện/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Sự kiện đang mở bán/).length).toBeGreaterThan(0);
      expect(screen.getAllByText('Bản nháp').length).toBeGreaterThan(0);
      const draftLink = screen.getAllByRole('link').find(el => el.getAttribute('href') === '/admin/concerts?status=draft');
      expect(draftLink).toBeInTheDocument();
      expect(screen.getAllByText(/Tổng vé phát hành/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Vé đã thanh toán/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Vé đang giữ/).length).toBeGreaterThan(0);
      expect(screen.getByText('Tỷ lệ bán vé')).toBeInTheDocument();
      expect(screen.getAllByText(/Doanh thu/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Check-in/).length).toBeGreaterThan(0);
      expect(screen.getAllByText('3').length).toBeGreaterThan(0);
      expect(screen.getAllByText('2').length).toBeGreaterThan(0);
      expect(screen.getAllByText('1').length).toBeGreaterThan(0);
      expect(screen.getAllByText('700').length).toBeGreaterThan(0);
      expect(screen.getAllByText('175').length).toBeGreaterThan(0);
      expect(screen.getByText('25%')).toBeInTheDocument();
      expect(screen.getByText('245.000.000 VND')).toBeInTheDocument();
      expect(screen.getAllByText(/90/).length).toBeGreaterThan(0);
    });
  });

  it('renders revenue trend, recent events, and per-concert sales progress', async () => {
    mockDashboardApi();

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Doanh thu 30 ngày')).toBeInTheDocument();
      expect(screen.getByText('150.000.000 VND')).toBeInTheDocument();
      expect(screen.getByText('45')).toBeInTheDocument();
      expect(screen.getAllByText(/đơn hàng/).length).toBeGreaterThan(0);
      expect(screen.getByText('Sự kiện gần đây')).toBeInTheDocument();
      expect(screen.getAllByText('Em Xinh Say Hi').length).toBeGreaterThan(0);
      expect(screen.getByText('Tiến độ bán vé')).toBeInTheDocument();
      expect(screen.getAllByText('170 / 500').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/5/).length).toBeGreaterThan(0);
      expect(screen.getByText(/325/)).toBeInTheDocument();
      expect(screen.getByText('210.000.000 VND')).toBeInTheDocument();
      expect(screen.getByText('34%')).toBeInTheDocument();
    });
  });

  it('calls the backend statistics endpoints instead of unavailable legacy dashboard stats', async () => {
    mockDashboardApi();

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(apiClient.request).toHaveBeenCalledWith('/statistics/overview');
      expect(apiClient.request).toHaveBeenCalledWith('/statistics/revenue?period=day');
      expect(apiClient.request).toHaveBeenCalledWith('/statistics/concerts/1');
      expect(apiClient.request).toHaveBeenCalledWith('/statistics/concerts/2');
    });

    expect(vi.mocked(apiClient.request).mock.calls.some(([url]) => url === '/admin/dashboard/statistics')).toBe(false);
    expect(vi.mocked(apiClient.request).mock.calls.some(([url]) => String(url).includes('/ticket-types'))).toBe(false);
  });

  it('renders API error message gracefully on overview failure', async () => {
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

  it('keeps dashboard usable when one concert statistics request fails', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(async (url) => {
      if (url === '/statistics/overview') return overview;
      if (url === '/statistics/revenue?period=day') return revenueSeries;
      if (String(url).startsWith('/concerts')) {
        const statusParam = new URLSearchParams(String(url).split('?')[1] || '').get('status');
        if (statusParam) {
          return { concerts: concerts.filter((c) => c.status === statusParam) };
        }
        return { concerts };
      }
      if (url === '/statistics/concerts/1') return concertOneStats;
      if (url === '/statistics/concerts/2') throw new Error('concert stats unavailable');

      return {};
    });

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Em Xinh Say Hi').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Chi Dep Dap Gio').length).toBeGreaterThan(0);
      expect(screen.getByText('Không tải được thống kê chi tiết của 1 sự kiện.')).toBeInTheDocument();
      expect(screen.getAllByText('170 / 500').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/5/).length).toBeGreaterThan(0);
      expect(screen.getByText('Lỗi dữ liệu')).toBeInTheDocument();
    });
  });
});
