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
      total_amount: 2000000,
      tickets: [
        { id: 'ticket_xyz789', ticket_type_id: 't1', qr_code_hash: 'hash1', checkin_status: 'pending' },
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
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
      expect(screen.getByText('ID: ticket_xyz789')).toBeInTheDocument();
      expect(screen.getByLabelText('QR Code')).toBeInTheDocument();
    });
  });

  it('renders failure message when payment status is not paid', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue({
      id: 'order_123',
      status: 'expired',
      total_amount: 2000000,
    });

    render(
      <MemoryRouter initialEntries={['/payment-callback/order_123']}>
        <Routes>
          <Route path="/payment-callback/:orderId" element={<PaymentCallback />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Payment Failed or Pending')).toBeInTheDocument();
      expect(screen.getByText(/We could not confirm your payment/i).toBeInTheDocument ? screen.getByText(/We could not confirm your payment/i) : screen.queryByText(/confirm/i)).toBeInTheDocument();
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
