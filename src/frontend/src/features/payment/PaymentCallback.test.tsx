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

  it('renders successful payment outcome with a local QR image generated from backend qrCodeHash', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(async (url) => {
      if (url === '/bookings/order_123') {
        return {
          id: 'order_123',
          status: 'paid',
          totalAmount: 2000000,
          tickets: [
            { id: 'ticket_xyz789', ticketTypeId: 't1', qrCodeHash: 'hash1', status: 'active', checkinStatus: 'not_checked_in' },
          ],
        };
      }

      if (url === '/payments/order_123') {
        return {
          orderId: 'order_123',
          orderStatus: 'paid',
          payments: [
            {
              id: 'payment_1',
              gateway: 'momo',
              status: 'success',
              transactionId: 'txn_123',
              amount: 2000000,
              createdAt: '2026-06-30T19:40:00Z',
            },
          ],
        };
      }

      return {};
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
      expect(screen.getByLabelText('Payment status')).toBeInTheDocument();
      expect(screen.getAllByText('momo').length).toBeGreaterThan(0);
      expect(screen.getAllByText('success').length).toBeGreaterThan(0);
      expect(screen.getAllByText('txn_123').length).toBeGreaterThan(0);
      expect(screen.getByLabelText('QR Code')).toHaveAttribute('src', expect.stringMatching(/^data:image\/png;base64,/));
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
