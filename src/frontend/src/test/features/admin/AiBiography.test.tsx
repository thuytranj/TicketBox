import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AiBiography } from '../../../features/admin/AiBiography';
import { apiClient } from '../../../api/client';
import { useSocket } from '../../../features/socket/SocketContext';

vi.mock('../../../api/client', () => ({
  apiClient: {
    request: vi.fn(),
  },
}));

vi.mock('../../../features/socket/SocketContext', () => ({
  useSocket: vi.fn(),
}));

describe('AiBiography', () => {
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
      <MemoryRouter initialEntries={['/admin/concerts/c1/bio']}>
        <Routes>
          <Route path="/admin/concerts/:id/bio" element={<AiBiography />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('renders file upload view when there is no existing bio', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(async (url, options) => {
      if (url === '/concerts/c1/artist-bio') {
        if (options?.method === 'POST') {
          return { message: 'Success' };
        }
        throw { status: 404, message: 'Not Found' };
      }
      return {};
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('No Biography Generated')).toBeInTheDocument();
      expect(screen.getByLabelText(/Artist Profile/i)).toBeInTheDocument();
    });

    const file = new File(['dummy pdf content'], 'profile.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByLabelText(/Artist Profile/i);

    fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    fireEvent.submit(fileInput.closest('form')!);

    await waitFor(() => {
      expect(apiClient.request).toHaveBeenCalledWith(
        '/concerts/c1/artist-bio',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
      expect(screen.getByText('Generating Biography')).toBeInTheDocument();
    });
  });

  it('polls for updates and resolves to completed', async () => {
    let callCount = 0;
    vi.spyOn(apiClient, 'request').mockImplementation(async (url) => {
      if (url === '/concerts/c1/artist-bio') {
        callCount++;
        if (callCount === 1) {
          return {
            concertId: 'c1',
            draftBio: null,
            status: 'processing',
            error: null,
            updatedAt: '2026-06-25T11:00:00Z',
          };
        }
        return {
          concertId: 'c1',
          draftBio: 'Taylor Swift is a singer-songwriter.',
          status: 'completed',
          error: null,
          updatedAt: '2026-06-25T11:01:00Z',
        };
      }
      return {};
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Generating Biography')).toBeInTheDocument();
    });

    // Wait for polling to fire and update UI
    await waitFor(
      () => {
        expect(screen.getByText('Generated Draft Biography')).toBeInTheDocument();
        expect(screen.getByLabelText(/Review and Edit Biography/i)).toHaveValue(
          'Taylor Swift is a singer-songwriter.'
        );
      },
      { timeout: 4000 }
    );
  });

  it('allows editing the biography and confirms it', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(async (url, options) => {
      if (url === '/concerts/c1/artist-bio') {
        return {
          concertId: 'c1',
          draftBio: 'Taylor Swift is a singer-songwriter.',
          status: 'completed',
          error: null,
          updatedAt: '2026-06-25T11:01:00Z',
        };
      }
      if (url === '/concerts/c1/artist-bio/confirm' && options?.method === 'PUT') {
        return { message: 'Confirmed' };
      }
      return {};
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByLabelText(/Review and Edit Biography/i)).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText(/Review and Edit Biography/i);
    fireEvent.change(textarea, { target: { value: 'Taylor Swift is an icon.' } });

    fireEvent.click(screen.getByRole('button', { name: /Confirm and Publish Biography/i }));

    await waitFor(() => {
      expect(apiClient.request).toHaveBeenCalledWith(
        '/concerts/c1/artist-bio/confirm',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ biography: 'Taylor Swift is an icon.' }),
        })
      );
      expect(screen.getByText('Biography approved and confirmed successfully.')).toBeInTheDocument();
    });
  });

  it('handles socket event notification_received to trigger refresh', async () => {
    let socketCallback: ((data: any) => void) | null = null;
    mockSocket.on.mockImplementation((event, cb) => {
      if (event === 'notification_received') {
        socketCallback = cb;
      }
    });

    let isCompleted = false;

    vi.spyOn(apiClient, 'request').mockImplementation(async (url) => {
      if (url === '/concerts/c1/artist-bio') {
        if (!isCompleted) {
          return {
            concertId: 'c1',
            draftBio: null,
            status: 'processing',
            error: null,
            updatedAt: '2026-06-25T11:00:00Z',
          };
        }
        return {
          concertId: 'c1',
          draftBio: 'Biography generated via socket notification.',
          status: 'completed',
          error: null,
          updatedAt: '2026-06-25T11:02:00Z',
        };
      }
      return {};
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Generating Biography')).toBeInTheDocument();
      expect(socketCallback).not.toBeNull();
    });

    // Simulate completion state for next fetch
    isCompleted = true;

    // Trigger socket callback with the backend enum value.
    if (socketCallback) {
      (socketCallback as any)({
        type: 'ai_bio_completed',
        referenceId: 'c1',
      });
    }

    await waitFor(() => {
      expect(screen.getByText('Generated Draft Biography')).toBeInTheDocument();
      expect(screen.getByLabelText(/Review and Edit Biography/i)).toHaveValue(
        'Biography generated via socket notification.'
      );
    });
  });
});
