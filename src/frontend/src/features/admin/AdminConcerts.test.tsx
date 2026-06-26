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
        location: 'Van Phuc City',
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

    // Find delete button and click it
    const trashButtons = screen.getAllByRole('button');
    const deleteButton = trashButtons[trashButtons.length - 1]; // last button is delete
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled();
      expect(screen.getByText('Concert deleted successfully.')).toBeInTheDocument();
    });
  });

  it('shows create form and submits new concert successfully', async () => {
    let concertsList: any[] = [];
    vi.spyOn(apiClient, 'request').mockImplementation(async (url, options) => {
      if (url === '/concerts') {
        if (options?.method === 'POST') {
          concertsList.push({
            id: 'c2',
            title: 'New Show',
            location: 'Stadium',
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
      expect(screen.getByText('Create Concert')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Create Concert'));

    expect(screen.getByText('Create New Concert')).toBeInTheDocument();

    // Fill form
    fireEvent.change(screen.getByLabelText(/Concert Title/i), { target: { value: 'New Show' } });
    fireEvent.change(screen.getByLabelText(/Location \/ Venue/i), { target: { value: 'Stadium' } });
    fireEvent.change(screen.getByLabelText(/Description/i), { target: { value: 'Great show.' } });
    fireEvent.change(screen.getByLabelText(/Start Time/i), { target: { value: '2026-07-01T18:00' } });
    fireEvent.change(screen.getByLabelText(/End Time/i), { target: { value: '2026-07-01T21:00' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Concert/i }));

    await waitFor(() => {
      expect(apiClient.request).toHaveBeenCalledWith(
        '/concerts',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"title":"New Show"'),
        })
      );
      expect(screen.getByText('Concert created successfully.')).toBeInTheDocument();
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
      expect(screen.getByText('Create Concert')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Create Concert'));

    const file = new File(['dummy content'], 'poster.png', { type: 'image/png' });
    const fileInput = screen.getByLabelText(/Upload Poster Image/i);

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
      expect(screen.getByText('Poster uploaded successfully.')).toBeInTheDocument();
    });
  });
});
