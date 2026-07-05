import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ConcertList } from '../../../features/concerts/ConcertList';
import { apiClient } from '../../../api/client';

vi.mock('../../../api/client', () => ({
  apiClient: {
    request: vi.fn(),
  },
}));

describe('ConcertList', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders list of active concerts', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue({
      concerts: [
        {
          id: 'c1',
          title: 'Anh Trai Say Hi',
          description: 'A live pop concert',
          location: 'Van Phuc City',
          posterUrl: '',
          startTime: '2026-06-30T19:30:00Z',
          tags: ['pop', 'live'],
          status: 'active',
        },
      ],
      meta: {
        totalItems: 1,
        itemCount: 1,
        itemsPerPage: 9,
        totalPages: 1,
        currentPage: 1,
      },
    });

    render(
      <MemoryRouter>
        <ConcertList />
      </MemoryRouter>
    );

    expect(screen.getByText('Đang tải sự kiện...')).toBeInTheDocument();
    await waitFor(() => {
      expect(apiClient.request).toHaveBeenCalledWith('/concerts?status=active&page=1&limit=9');
      expect(screen.getByText('Anh Trai Say Hi')).toBeInTheDocument();
      expect(screen.getByText('Van Phuc City')).toBeInTheDocument();
    });
  });

  it('supports pagination from backend metadata', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue({
      concerts: [],
      meta: {
        totalItems: 18,
        itemCount: 9,
        itemsPerPage: 9,
        totalPages: 2,
        currentPage: 1,
      },
    });

    render(
      <MemoryRouter>
        <ConcertList />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Trang/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Sau/i }));

    await waitFor(() => {
      expect(apiClient.request).toHaveBeenCalledWith('/concerts?status=active&page=2&limit=9');
    });
  });

  it('uses a friendly event discovery hero without external stock imagery', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue({
      concerts: [],
    });

    render(
      <MemoryRouter>
        <ConcertList />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Tìm show hợp gu/i })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /organizer portal/i })).not.toBeInTheDocument();
    });

    const heroImage = screen.getByAltText(/ticketbox event preview/i) as HTMLImageElement;
    expect(heroImage.src).not.toContain('unsplash.com');
  });
});
