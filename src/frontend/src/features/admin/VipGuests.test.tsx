import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { VipGuests } from './VipGuests';
import { apiClient } from '../../api/client';
import { useSocket } from '../socket/SocketContext';

vi.mock('../../api/client', () => ({
  apiClient: {
    request: vi.fn(),
  },
}));

vi.mock('../socket/SocketContext', () => ({
  useSocket: vi.fn(),
}));

describe('VipGuests', () => {
  const mockSocket = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };

  beforeEach(() => {
    cleanup();
    vi.resetAllMocks();
    vi.mocked(useSocket).mockReturnValue({ socket: mockSocket as any, connected: true });
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter initialEntries={['/admin/concerts/c1/guests']}>
        <Routes>
          <Route path="/admin/concerts/:id/guests" element={<VipGuests />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('renders guests list and search options', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(async (url) => {
      if (url.startsWith('/concerts/c1/guests') && !url.includes('/import')) {
        return {
          data: [
            {
              id: 'g1',
              fullName: 'John Doe',
              email: 'john@example.com',
              phone: '123456',
              affiliateCompany: 'Company A',
              status: 'active',
              checkinStatus: 'not_checked_in',
            },
          ],
          meta: {
            totalPages: 1,
            totalItems: 1,
          },
        };
      }
      return {};
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('Company A')).toBeInTheDocument();
      expect(screen.getByText('Not Checked In')).toBeInTheDocument();
    });
  });

  it('triggers CSV guest file upload and starts job', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(async (url, options) => {
      if (url.startsWith('/concerts/c1/guests') && !url.includes('/import')) {
        return { data: [], meta: { totalPages: 1, totalItems: 0 } };
      }
      if (url === '/concerts/c1/guests/import' && options?.method === 'POST') {
        return { jobId: 'job123', status: 'processing' };
      }
      return {};
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByLabelText(/Select CSV File/i)).toBeInTheDocument();
    });

    const file = new File(['fullName,email\nJohn,john@mail.com'], 'guests.csv', { type: 'text/csv' });
    const fileInput = screen.getByLabelText(/Select CSV File/i);

    fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    fireEvent.submit(fileInput.closest('form')!);

    await waitFor(() => {
      expect(apiClient.request).toHaveBeenCalledWith(
        '/concerts/c1/guests/import',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
      expect(screen.getByText('Import Progress')).toBeInTheDocument();
    });
  });

  it('listens to vip_import_status socket event to update progress', async () => {
    let socketCallback: ((data: any) => void) | null = null;
    mockSocket.on.mockImplementation((event, cb) => {
      if (event === 'vip_import_status') {
        socketCallback = cb;
      }
    });

    vi.spyOn(apiClient, 'request').mockImplementation(async (url, options) => {
      if (url.startsWith('/concerts/c1/guests') && !url.includes('/import')) {
        return { data: [], meta: { totalPages: 1, totalItems: 0 } };
      }
      if (url === '/concerts/c1/guests/import' && options?.method === 'POST') {
        return { jobId: 'job123', status: 'pending' };
      }
      return {};
    });

    renderComponent();

    const file = new File(['fullName,email\nJohn,john@mail.com'], 'guests.csv', { type: 'text/csv' });
    const fileInput = screen.getByLabelText(/Select CSV File/i);
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.submit(fileInput.closest('form')!);

    // Wait for the POST request to resolve and the import UI to render (ensures state updates)
    await screen.findByText('Import Progress');

    // Simulate socket progress update
    if (socketCallback) {
      act(() => {
        (socketCallback as any)({
          id: 'job123',
          concertId: 'c1',
          status: 'processing',
          totalRows: 10,
          importedRows: 5,
          errorLogs: null,
        });
      });
    }

    await waitFor(() => {
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('5 / 10 rows')).toBeInTheDocument();
    });
  });

  it('renders warnings table if errorLogs are returned', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(async (url, options) => {
      if (url.startsWith('/concerts/c1/guests') && !url.includes('/import')) {
        return { data: [], meta: { totalPages: 1, totalItems: 0 } };
      }
      if (url === '/concerts/c1/guests/import' && options?.method === 'POST') {
        return { jobId: 'job123', status: 'processing' };
      }
      if (url === '/concerts/c1/guests/imports/job123') {
        return {
          id: 'job123',
          concertId: 'c1',
          status: 'completed',
          totalRows: 5,
          importedRows: 4,
          errorLogs: [
            { row: 3, email: 'dup@mail.com', reason: 'Email is already registered' },
          ],
        };
      }
      return {};
    });

    renderComponent();

    const file = new File(['fullName,email\nJohn,john@mail.com'], 'guests.csv', { type: 'text/csv' });
    const fileInput = screen.getByLabelText(/Select CSV File/i);
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.submit(fileInput.closest('form')!);

    // Add extra timeout so that the 3-second fallback setInterval has time to run and resolve
    await waitFor(() => {
      expect(screen.getByText('Import Warnings (1)')).toBeInTheDocument();
      expect(screen.getByText('Email is already registered')).toBeInTheDocument();
      expect(screen.getByText('dup@mail.com')).toBeInTheDocument();
    }, { timeout: 4500 });
  });
});
