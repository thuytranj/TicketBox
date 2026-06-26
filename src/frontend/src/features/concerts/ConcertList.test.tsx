import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ConcertList } from './ConcertList';
import { apiClient } from '../../api/client';

vi.mock('../../api/client', () => ({
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
      data: {
        concerts: [
          {
            id: 'c1',
            title: 'Anh Trai Say Hi',
            description: 'A live pop concert',
            location: 'Van Phuc City',
            posterUrl: '',
            start_time: '2026-06-30T19:30:00Z',
            tags: ['pop', 'live'],
            status: 'active',
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <ConcertList />
      </MemoryRouter>
    );

    expect(screen.getByText('Đang tải sự kiện...')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Anh Trai Say Hi')).toBeInTheDocument();
      expect(screen.getByText('Van Phuc City')).toBeInTheDocument();
    });
  });

  it('uses a friendly event discovery hero without external stock imagery', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue({
      data: {
        concerts: [],
      },
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
