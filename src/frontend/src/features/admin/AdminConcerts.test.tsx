import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AdminConcerts } from './AdminConcerts';
import { apiClient } from '../../api/client';

vi.mock('../../api/client', () => ({
  apiClient: {
    request: vi.fn(),
  },
}));

describe('AdminConcerts', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('lists existing concerts and triggers deletion successfully', async () => {
    const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    let concertsList = [
      {
        id: 'c1',
        title: 'Anh Trai Say Hi',
        description: 'Show description',
        location: 'Van Phuc City',
        posterUrl: '',
        start_time: '2026-06-30T19:30:00Z',
        tags: ['pop'],
        status: 'active',
      },
    ];

    vi.spyOn(apiClient, 'request').mockImplementation(async (url, options) => {
      if (url === '/concerts') {
        return { data: { concerts: concertsList } };
      }
      if (url === '/concerts/c1' && options?.method === 'DELETE') {
        concertsList = [];
        return { message: 'Deleted' };
      }
      return { data: { concerts: [] } };
    });

    render(
      <MemoryRouter>
        <AdminConcerts />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Anh Trai Say Hi')).toBeInTheDocument();
      expect(screen.getByText('Van Phuc City')).toBeInTheDocument();
    });

    const deleteButton = screen.getAllByRole('button').at(-1)!;
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled();
      expect(screen.getByText('Đã xóa concert.')).toBeInTheDocument();
    });
  });

  it('submits a new concert with initial ticket types and status', async () => {
    let concertsList: any[] = [];
    vi.spyOn(apiClient, 'request').mockImplementation(async (url, options) => {
      if (url === '/concerts') {
        if (options?.method === 'POST') {
          concertsList.push({
            id: 'c2',
            title: 'New Show',
            description: 'Great show.',
            location: 'Stadium',
            posterUrl: '',
            start_time: '2026-07-01T18:00:00Z',
            tags: [],
            status: 'active',
          });
          return { id: 'c2' };
        }
        return { data: { concerts: concertsList } };
      }
      return { data: { concerts: [] } };
    });

    render(
      <MemoryRouter>
        <AdminConcerts />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Tạo concert')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Tạo concert'));
    expect(screen.getByText('Tạo concert mới')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Tên concert/i), { target: { value: 'New Show' } });
    fireEvent.change(screen.getByLabelText(/Địa điểm/i), { target: { value: 'Stadium' } });
    fireEvent.change(screen.getByLabelText(/Mô tả/i), { target: { value: 'Great show.' } });
    fireEvent.change(screen.getByLabelText(/Thời gian bắt đầu/i), { target: { value: '2026-07-01T18:00' } });
    fireEvent.change(screen.getByLabelText(/Thời gian kết thúc/i), { target: { value: '2026-07-01T21:00' } });
    fireEvent.change(screen.getByLabelText(/Giá \(VND\)/i), { target: { value: '1200000' } });
    fireEvent.change(screen.getByLabelText(/Số lượng/i), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: /^Thêm$/i }));

    fireEvent.click(screen.getByRole('button', { name: /Lưu concert/i }));

    await waitFor(() => {
      const createCall = vi.mocked(apiClient.request).mock.calls.find(([url, options]) => (
        url === '/concerts' && options?.method === 'POST'
      ));
      expect(JSON.parse(createCall?.[1]?.body as string)).toMatchObject({
        title: 'New Show',
        status: 'active',
        ticketTypes: [
          {
            name: 'GA',
            price: 1200000,
            totalQuantity: 80,
            maxPerUser: 4,
          },
        ],
      });
      expect(screen.getByText('Đã tạo concert.')).toBeInTheDocument();
    });
  });

  it('triggers poster image upload on file change', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(async (url, options) => {
      if (url === '/concerts') {
        return { data: { concerts: [] } };
      }
      if (url === '/concerts/upload-poster' && options?.method === 'POST') {
        return { url: 'https://cloudinary.com/poster.jpg', publicId: 'pid123' };
      }
      return { data: { concerts: [] } };
    });

    render(
      <MemoryRouter>
        <AdminConcerts />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Tạo concert')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Tạo concert'));

    const file = new File(['dummy content'], 'poster.png', { type: 'image/png' });
    const fileInput = screen.getByLabelText(/Poster sự kiện/i);

    Object.defineProperty(fileInput, 'files', {
      value: [file],
    });

    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(apiClient.request).toHaveBeenCalledWith(
        '/concerts/upload-poster',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(screen.getByText('Đã tải poster lên.')).toBeInTheDocument();
    });
  });

  it('reads uploaded SVG text into the stage map field before saving', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue({ data: { concerts: [] } });

    render(
      <MemoryRouter>
        <AdminConcerts />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Tạo concert')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Tạo concert'));

    const svgText = '<svg><g id="GA"></g></svg>';
    const svgFile = new File([svgText], 'map.svg', { type: 'image/svg+xml' });
    const svgInput = screen.getByLabelText(/Tải file SVG/i);

    Object.defineProperty(svgInput, 'files', {
      value: [svgFile],
    });

    fireEvent.change(svgInput);

    await waitFor(() => {
      expect(screen.getByLabelText(/Sơ đồ ghế SVG/i)).toHaveValue(svgText);
    });
  });
});
