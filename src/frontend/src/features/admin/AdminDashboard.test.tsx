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
  });

  it('renders stats counters and recent events without unfinished analytics placeholder', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue({
      data: {
        concerts: [
          { id: '1', title: 'Em Xinh Say Hi', status: 'active', tags: [], location: 'Ho Chi Minh City', start_time: '2026-06-30T19:30:00Z' },
          { id: '2', title: 'Chị Đẹp Đạp Gió', status: 'draft', tags: [], location: 'Ha Noi', start_time: '2026-07-01T19:30:00Z' },
          { id: '3', title: 'Anh Trai Vượt Ngàn', status: 'active', tags: [], location: 'Da Nang', start_time: '2026-07-02T19:30:00Z' },
        ],
      },
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
      expect(screen.getByText('Em Xinh Say Hi')).toBeInTheDocument();
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
});
