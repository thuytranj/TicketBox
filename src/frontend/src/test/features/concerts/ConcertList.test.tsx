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

    // Switch to active tab first
    fireEvent.click(await screen.findByRole('button', { name: /Sắp diễn ra & Đang bán/i }));

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

    // Switch to active tab first
    fireEvent.click(await screen.findByRole('button', { name: /Sắp diễn ra & Đang bán/i }));

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

  it('renders a Link with text "Đã kết thúc (Xem chi tiết)" pointing to /concerts/c1 when concert is in the past', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue({
      concerts: [
        {
          id: 'c1',
          title: 'Ended Concert',
          description: 'A concert in the past',
          location: 'Old Venue',
          posterUrl: '',
          startTime: '2026-06-30T19:30:00Z',
          endTime: '2026-06-30T22:30:00Z',
          tags: ['old'],
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

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /Đã kết thúc \(Xem chi tiết\)/i });
      expect(link).toBeInTheDocument();
      expect(link.getAttribute('href')).toBe('/concerts/c1');
    });
  });

  it('filters list client-side when selecting a city from the dropdown', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue({
      concerts: [
        {
          id: 'c1',
          title: 'Hanoi Concert',
          description: 'Show in Hanoi',
          location: 'Sân vận động Mỹ Đình, Hà Nội',
          posterUrl: '',
          startTime: '2026-07-20T19:30:00Z',
          tags: ['pop'],
          status: 'active',
        },
        {
          id: 'c2',
          title: 'HCM Concert',
          description: 'Show in Saigon',
          location: 'Nhà thi đấu Phú Thọ, TP. Hồ Chí Minh',
          posterUrl: '',
          startTime: '2026-07-25T19:30:00Z',
          tags: ['pop'],
          status: 'active',
        },
      ]
    });

    render(
      <MemoryRouter>
        <ConcertList />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Hanoi Concert')).toBeInTheDocument();
      expect(screen.getByText('HCM Concert')).toBeInTheDocument();
    });

    const locationSelect = screen.getByLabelText(/Lọc theo địa điểm/i);
    fireEvent.change(locationSelect, { target: { value: 'Hà Nội' } });

    expect(screen.getByText('Hanoi Concert')).toBeInTheDocument();
    expect(screen.queryByText('HCM Concert')).not.toBeInTheDocument();
  });
});
