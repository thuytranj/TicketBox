import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ConcertDetail } from './ConcertDetail';
import { apiClient } from '../../api/client';
import { AuthProvider } from '../auth/AuthContext';

vi.mock('../../api/client', () => ({
  apiClient: {
    request: vi.fn(),
  },
}));

describe('ConcertDetail', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders concert details, ticket types, and reacts to selections', async () => {
    vi.spyOn(apiClient, 'request')
      .mockResolvedValueOnce({
        data: {
          id: 'c1',
          title: 'Anh Trai Say Hi',
          location: 'Van Phuc City',
          start_time: '2026-06-30T19:30:00Z',
          description: 'Concert event desc.',
        },
      })
      .mockResolvedValueOnce({
        data: [
          { id: 't1', name: 'SVIP', price: 2000000, total_quantity: 100, available_quantity: 40, max_per_user: 2 },
          { id: 't2', name: 'GA', price: 800000, total_quantity: 500, available_quantity: 100, max_per_user: 4 },
        ],
      })
      .mockResolvedValueOnce({ svgStageMap: '' });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/concerts/c1']}>
          <Routes>
            <Route path="/concerts/:id" element={<ConcertDetail />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Anh Trai Say Hi')).toBeInTheDocument();
      expect(screen.getByText('SVIP')).toBeInTheDocument();
      expect(screen.getByText('GA')).toBeInTheDocument();
    });

    // Select SVIP
    fireEvent.click(screen.getByText('SVIP'));
    expect(screen.getByText('Total Amount')).toBeInTheDocument();
    expect(screen.getAllByText(/2[.,]000[.,]000 VND/).length).toBeGreaterThan(0);
  });
});
