import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PaymentCallback } from '../../../features/payment/PaymentCallback';
import { apiClient } from '../../../api/client';

vi.mock('../../../api/client', () => ({
  apiClient: {
    request: vi.fn(),
  },
}));

describe('PaymentCallback', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
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

  it('submits MoMo redirect parameters before polling payment status', async () => {
    window.history.pushState(
      {},
      '',
      '/payment-callback/order_123?partnerCode=MOMO&orderId=order_123&resultCode=0&signature=sig_123',
    );
    const requestSpy = vi.spyOn(apiClient, 'request').mockImplementation(async (url) => {
      if (String(url).startsWith('/payments/momo/webhook?')) {
        return { message: 'received' };
      }

      if (url === '/bookings/order_123') {
        return {
          id: 'order_123',
          status: 'paid',
          totalAmount: 2000000,
          tickets: [],
        };
      }

      if (url === '/payments/order_123') {
        return {
          orderId: 'order_123',
          orderStatus: 'paid',
          payments: [],
        };
      }

      return {};
    });

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/payment-callback/order_123',
            search: '?partnerCode=MOMO&orderId=order_123&resultCode=0&signature=sig_123',
          },
        ]}
      >
        <Routes>
          <Route path="/payment-callback/:orderId" element={<PaymentCallback />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Payment Successful!/i)).toBeInTheDocument();
    });

    expect(requestSpy).toHaveBeenCalledWith(
      '/payments/momo/webhook?partnerCode=MOMO&orderId=order_123&resultCode=0&signature=sig_123',
      { method: 'POST' },
    );
  });

  it('renders cancelled state immediately when MoMo reports a cancelled transaction', async () => {
    window.history.pushState(
      {},
      '',
      '/payment-callback/order_123?partnerCode=MOMO&orderId=order_123&resultCode=1002&message=Giao+d%E1%BB%8Bch+b%E1%BB%8B+t%E1%BB%AB+ch%E1%BB%91i&signature=sig_123',
    );

    vi.spyOn(apiClient, 'request').mockImplementation(async (url) => {
      if (String(url).startsWith('/payments/momo/webhook?')) {
        return { message: 'received' };
      }

      return {
        id: 'order_123',
        status: 'pending',
        totalAmount: 2000000,
      };
    });

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/payment-callback/order_123',
            search: '?partnerCode=MOMO&orderId=order_123&resultCode=1002&message=Giao+d%E1%BB%8Bch+b%E1%BB%8B+t%E1%BB%AB+ch%E1%BB%91i&signature=sig_123',
          },
        ]}
      >
        <Routes>
          <Route path="/payment-callback/:orderId" element={<PaymentCallback />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Thanh toán đã bị hủy/i)).toBeInTheDocument();
      expect(screen.getByText(/Giao dịch bị từ chối/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Payment Status Pending/i)).not.toBeInTheDocument();
  });

  it('renders cancelled state when MoMo reports an order cancellation message without a result code', async () => {
    const search =
      '?partnerCode=MOMO&orderId=order_123&message=L%E1%BB%97i%3A+%C4%90%C6%A1n+h%C3%A0ng+%C4%91%C3%A3+b%E1%BB%8B+hu%E1%BB%B7+b%E1%BB%8F&signature=sig_123';
    window.history.pushState({}, '', `/payment-callback/order_123${search}`);

    vi.spyOn(apiClient, 'request').mockImplementation(async (url) => {
      if (String(url).startsWith('/payments/momo/webhook?')) {
        return { message: 'received' };
      }

      return {
        id: 'order_123',
        status: 'pending',
        totalAmount: 2000000,
      };
    });

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/payment-callback/order_123',
            search,
          },
        ]}
      >
        <Routes>
          <Route path="/payment-callback/:orderId" element={<PaymentCallback />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Thanh toán đã bị hủy/i)).toBeInTheDocument();
      expect(screen.getByText(/Đơn hàng đã bị huỷ bỏ/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Payment Status Pending/i)).not.toBeInTheDocument();
  });

  it('renders failed state immediately when MoMo reports a non-success result', async () => {
    window.history.pushState(
      {},
      '',
      '/payment-callback/order_123?partnerCode=MOMO&orderId=order_123&resultCode=99&message=Payment+failed&signature=sig_123',
    );

    vi.spyOn(apiClient, 'request').mockImplementation(async (url) => {
      if (String(url).startsWith('/payments/momo/webhook?')) {
        return { message: 'received' };
      }

      return {
        id: 'order_123',
        status: 'pending',
        totalAmount: 2000000,
      };
    });

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/payment-callback/order_123',
            search: '?partnerCode=MOMO&orderId=order_123&resultCode=99&message=Payment+failed&signature=sig_123',
          },
        ]}
      >
        <Routes>
          <Route path="/payment-callback/:orderId" element={<PaymentCallback />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Thanh toán thất bại/i)).toBeInTheDocument();
      expect(screen.getByText(/Payment failed/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Payment Status Pending/i)).not.toBeInTheDocument();
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
      expect(screen.getByText(/Thanh toán thất bại/i)).toBeInTheDocument();
      expect(screen.getByText(/Giao dịch chưa hoàn tất/i)).toBeInTheDocument();
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

  it('submits VNPAY redirect parameters and processes successful payment', async () => {
    const search = '?vnp_Amount=200000000&vnp_ResponseCode=00&vnp_TxnRef=order_123&vnp_SecureHash=hash_123';
    window.history.pushState({}, '', `/payment-callback/order_123${search}`);

    const requestSpy = vi.spyOn(apiClient, 'request').mockImplementation(async (url) => {
      if (String(url).startsWith('/payments/vnpay/webhook?')) {
        return { message: 'received' };
      }

      if (url === '/bookings/order_123') {
        return {
          id: 'order_123',
          status: 'paid',
          totalAmount: 2000000,
          tickets: [],
        };
      }

      if (url === '/payments/order_123') {
        return {
          orderId: 'order_123',
          orderStatus: 'paid',
          payments: [],
        };
      }

      return {};
    });

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/payment-callback/order_123',
            search,
          },
        ]}
      >
        <Routes>
          <Route path="/payment-callback/:orderId" element={<PaymentCallback />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Payment Successful!/i)).toBeInTheDocument();
    });

    expect(requestSpy).toHaveBeenCalledWith(
      `/payments/vnpay/webhook${search}`,
      { method: 'POST' },
    );
  });

  it('renders VNPAY cancelled state and supports query param extraction without path orderId', async () => {
    const search = '?vnp_Amount=200000000&vnp_ResponseCode=24&vnp_TxnRef=order_123&vnp_SecureHash=hash_123';
    window.history.pushState({}, '', `/payment/callback/vnpay${search}`);

    vi.spyOn(apiClient, 'request').mockImplementation(async (url) => {
      if (String(url).startsWith('/payments/vnpay/webhook?')) {
        return { message: 'received' };
      }

      return {
        id: 'order_123',
        status: 'pending',
        totalAmount: 2000000,
      };
    });

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/payment/callback/vnpay',
            search,
          },
        ]}
      >
        <Routes>
          <Route path="/payment/callback/vnpay" element={<PaymentCallback />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Thanh toán đã bị hủy/i)).toBeInTheDocument();
    });
  });
});
