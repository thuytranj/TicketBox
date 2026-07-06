import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AdminConcerts } from '../../../features/admin/AdminConcerts';
import { apiClient } from '../../../api/client';

vi.mock('../../../api/client', () => ({
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
        startTime: '2026-06-30T19:30:00Z',
        tags: ['pop'],
        status: 'active',
      },
    ];

    vi.spyOn(apiClient, 'request').mockImplementation(async (url, options) => {
      if (url === '/concerts?page=1&limit=100') {
        return { concerts: concertsList };
      }
      if (url === '/concerts/c1' && options?.method === 'DELETE') {
        concertsList = [];
        return { message: 'Deleted' };
      }
      return { concerts: [] };
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
      expect(screen.getByText('Đã xóa sự kiện.')).toBeInTheDocument();
    });
  });

  it('submits a new concert with initial ticket types and status', async () => {
    let concertsList: any[] = [];
    vi.spyOn(apiClient, 'request').mockImplementation(async (url, options) => {
      if (url === '/concerts' && options?.method === 'POST') {
        concertsList.push({
          id: 'c2',
          title: 'New Show',
          description: 'Great show.',
          location: 'Stadium',
          posterUrl: '',
          startTime: '2026-07-01T18:00:00Z',
          tags: [],
          status: 'active',
        });
        return { id: 'c2' };
      }
      if (url === '/concerts?page=1&limit=100') {
        return { concerts: concertsList };
      }
      return { concerts: [] };
    });

    render(
      <MemoryRouter>
        <AdminConcerts />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Tạo sự kiện')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Tạo sự kiện'));
    expect(screen.getByText('Tạo sự kiện mới')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Tên sự kiện/i), { target: { value: 'New Show' } });
    fireEvent.change(screen.getByLabelText(/Địa điểm/i), { target: { value: 'Stadium' } });
    fireEvent.change(screen.getByLabelText(/Mô tả/i), { target: { value: 'Great show.' } });
    fireEvent.change(screen.getByLabelText(/Thời gian bắt đầu/i), { target: { value: '2026-07-01T18:00' } });
    fireEvent.change(screen.getByLabelText(/Thời gian kết thúc/i), { target: { value: '2026-07-01T21:00' } });
    fireEvent.change(screen.getByLabelText(/Giá \(VND\)/i), { target: { value: '1200000' } });
    fireEvent.change(screen.getByLabelText(/Số lượng/i), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: /^Thêm$/i }));

    fireEvent.click(screen.getByRole('button', { name: /Lưu sự kiện/i }));

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
      expect(screen.getByText('Đã tạo sự kiện.')).toBeInTheDocument();
    });
  });

  it('triggers poster image upload on file change', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(async (url, options) => {
      if (url === '/concerts?page=1&limit=100') {
        return { concerts: [] };
      }
      if (url === '/concerts/upload-poster' && options?.method === 'POST') {
        return { url: 'https://cloudinary.com/poster.jpg', publicId: 'pid123' };
      }
      return { concerts: [] };
    });

    render(
      <MemoryRouter>
        <AdminConcerts />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Tạo sự kiện')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Tạo sự kiện'));

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
    vi.spyOn(apiClient, 'request').mockResolvedValue({ concerts: [] });

    render(
      <MemoryRouter>
        <AdminConcerts />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Tạo sự kiện')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Tạo sự kiện'));

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

  it('filters concerts by status without refetching from the backend', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(async (url) => {
      if (url === '/concerts?page=1&limit=100') {
        return {
          concerts: [
            {
              id: 'active-1',
              title: 'Active Show',
              description: 'Active desc',
              location: 'Arena',
              posterUrl: '',
              startTime: '2026-07-01T18:00:00Z',
              tags: [],
              status: 'active',
            },
            {
              id: 'draft-1',
              title: 'Draft Show',
              description: 'Draft desc',
              location: 'Studio',
              posterUrl: '',
              startTime: '2026-08-01T18:00:00Z',
              tags: [],
              status: 'draft',
            },
          ],
        };
      }
      return { concerts: [] };
    });

    render(
      <MemoryRouter>
        <AdminConcerts />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Active Show')).toBeInTheDocument();
      expect(screen.getByText('Draft Show')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Lọc trạng thái/i), { target: { value: 'draft' } });

    expect(screen.queryByText('Active Show')).not.toBeInTheDocument();
    expect(screen.getByText('Draft Show')).toBeInTheDocument();
  });

  it('opens directly to the draft filter from the dashboard link', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(async (url) => {
      if (url === '/concerts?status=active&page=1&limit=100') {
        return {
          concerts: [
            {
              id: 'active-1',
              title: 'Active Show',
              description: 'Active desc',
              location: 'Arena',
              posterUrl: '',
              startTime: '2026-07-01T18:00:00Z',
              tags: [],
              status: 'active',
            },
          ],
        };
      }
      if (url === '/concerts?status=draft&page=1&limit=100') {
        return {
          concerts: [
            {
              id: 'draft-1',
              title: 'Draft Show',
              description: 'Draft desc',
              location: 'Studio',
              posterUrl: '',
              startTime: '2026-08-01T18:00:00Z',
              tags: [],
              status: 'draft',
            },
          ],
        };
      }
      if (url === '/concerts?status=cancelled&page=1&limit=100') {
        return { concerts: [] };
      }
      return { concerts: [] };
    });

    render(
      <MemoryRouter initialEntries={['/admin/concerts?status=draft']}>
        <AdminConcerts />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('Active Show')).not.toBeInTheDocument();
      expect(screen.getByText('Draft Show')).toBeInTheDocument();
      expect(screen.getByLabelText(/Lọc trạng thái/i)).toHaveValue('draft');
    });
  });

  it('updates an existing ticket type through PATCH', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(async (url, options) => {
      if (url === '/concerts?page=1&limit=100') {
        return {
          concerts: [
            {
              id: 'c1',
              title: 'Editable Show',
              description: 'Editable desc',
              location: 'Arena',
              posterUrl: '',
              startTime: '2026-07-01T18:00:00Z',
              tags: [],
              status: 'active',
            },
          ],
        };
      }
      if (url === '/concerts/c1/ticket-types') {
        return [
          {
            id: 't1',
            name: 'GA',
            price: 500000,
            totalQuantity: 100,
            availableQuantity: 100,
            maxPerUser: 4,
          },
        ];
      }
      if (url === '/concerts/c1/stagemap') {
        return { svgStageMap: '' };
      }
      if (url === '/ticket-types/t1' && options?.method === 'PATCH') {
        return { id: 't1' };
      }
      return {};
    });

    render(
      <MemoryRouter>
        <AdminConcerts />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Editable Show')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Chỉnh sửa sự kiện Editable Show'));

    await waitFor(() => {
      expect(screen.getByText('GA')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Sửa hạng vé GA'));
    fireEvent.change(screen.getByLabelText('Giá hạng vé đang sửa'), { target: { value: '650000' } });
    fireEvent.change(screen.getByLabelText('Số lượng hạng vé đang sửa'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('Tối đa mỗi người hạng vé đang sửa'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /Lưu hạng vé/i }));

    await waitFor(() => {
      expect(apiClient.request).toHaveBeenCalledWith(
        '/ticket-types/t1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            name: 'GA',
            price: 650000,
            totalQuantity: 120,
            maxPerUser: 2,
          }),
        })
      );
      expect(screen.getByText('Đã cập nhật hạng vé.')).toBeInTheDocument();
    });
  });
  it('loads the full admin concert list from the backend page size used for management views', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(async (url) => {
      if (url === '/concerts?status=active&page=1&limit=100') {
        return {
          concerts: [
            {
              id: 'c1',
              title: 'Full List Show',
              description: 'Show description',
              location: 'Arena',
              posterUrl: '',
              startTime: '2026-07-01T18:00:00Z',
              tags: [],
              status: 'active',
            },
          ],
        };
      }
      if (url === '/concerts?status=draft&page=1&limit=100') {
        return {
          concerts: [
            {
              id: 'draft-1',
              title: 'Draft List Show',
              description: 'Draft description',
              location: 'Studio',
              posterUrl: '',
              startTime: '2026-08-01T18:00:00Z',
              tags: [],
              status: 'draft',
            },
          ],
        };
      }
      if (url === '/concerts?status=cancelled&page=1&limit=100') {
        return { concerts: [] };
      }
      return { concerts: [] };
    });

    render(
      <MemoryRouter>
        <AdminConcerts />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(apiClient.request).toHaveBeenCalledWith('/concerts?status=active&page=1&limit=100');
      expect(apiClient.request).toHaveBeenCalledWith('/concerts?status=draft&page=1&limit=100');
      expect(apiClient.request).toHaveBeenCalledWith('/concerts?status=cancelled&page=1&limit=100');
      expect(screen.getByText('Full List Show')).toBeInTheDocument();
      expect(screen.getByText('Draft List Show')).toBeInTheDocument();
    });
  });

  it('validates ticket type values before storing them in the concert form', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue({ concerts: [] });

    render(
      <MemoryRouter>
        <AdminConcerts />
      </MemoryRouter>
    );

    const createButton = await screen.findByRole('button', { name: /Tạo sự kiện/i });
    fireEvent.click(createButton);
    fireEvent.change(screen.getByLabelText(/Giá \(VND\)/i), { target: { value: '-1' } });
    fireEvent.change(screen.getByLabelText(/Số lượng/i), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(/Tối đa\/người/i), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /^Thêm$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Giá vé không được âm');
  });
});
