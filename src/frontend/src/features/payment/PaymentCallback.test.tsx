import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PaymentCallback } from './PaymentCallback';
import { apiClient } from '../../api/client';

vi.mock('../../api/client', () => ({
  apiClient: {
    request: vi.fn(),
  },
}));

describe('PaymentCallback', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders successful payment outcome along with ticket and mock QR code', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue({
      id: 'order_123',
      status: 'paid',
      totalAmount: 2000000,
      tickets: [
        { id: 'ticket_xyz789', ticketTypeId: 't1', qrCode: 'hash1', status: 'reserved' },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/payment-callback/order_123']}>
        <Routes>
          <Route path="/payment-callback/:orderId" element={<PaymentCallback />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Payment Successful!/i)).toBeInTheDocument();
      expect(screen.getByText(/ticket_xyz789/i)).toBeInTheDocument();
      expect(screen.getByLabelText('QR Code')).toBeInTheDocument();
    });
  });

  it('renders failure message when payment status is not paid', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue({
      id: 'order_123',
      status: 'expired',
      totalAmount: 2000000,
    });

    render(
      <MemoryRouter initialEntries={['/payment-callback/order_123']}>
        <Routes>
          <Route path="/payment-callback/:orderId" element={<PaymentCallback />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Payment Failed/i)).toBeInTheDocument();
      expect(screen.getAllByText(/expired/i).length).toBeGreaterThan(0);
    });
  });

  it('renders API error message gracefully', async () => {
    vi.spyOn(apiClient, 'request').mockRejectedValue(new Error('Gateway checksum mismatch'));

    render(
      <MemoryRouter initialEntries={['/payment-callback/order_123']}>
        <Routes>
          <Route path="/payment-callback/:orderId" element={<PaymentCallback />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Gateway checksum mismatch')).toBeInTheDocument();
    });
  });
});
