import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CheckoutPage } from './CheckoutPage';
import { apiClient } from '../../api/client';

vi.mock('../../api/client', () => ({
  apiClient: {
    request: vi.fn(),
  },
}));

describe('CheckoutPage', () => {
  const originalLocation = window.location;
  const activeBookingCreatedAt = () => new Date(Date.now()).toISOString();

  beforeAll(() => {
    // Mock window.location.href
    delete (window as any).location;
    window.location = {
      href: '',
      assign: vi.fn(),
      replace: vi.fn(),
      reload: vi.fn(),
    } as any;
  });

  afterAll(() => {
    (window as any).location = originalLocation;
  });

  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.location.href = '';
  });


  it('renders booking details and disables gateway button if its status is OPEN', async () => {
    vi.spyOn(apiClient, 'request')
      .mockResolvedValueOnce({
        id: 'order_abc123',
        totalAmount: 1500000,
        createdAt: activeBookingCreatedAt(),
        status: 'pending',
      })
      .mockResolvedValueOnce({
        momo: 'OPEN',
        vnpay: 'CLOSED',
      });

    render(
      <MemoryRouter initialEntries={['/checkout/order_abc123']}>
        <Routes>
          <Route path="/checkout/:orderId" element={<CheckoutPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Checkout')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Thanh toán')).toBeInTheDocument();
      expect(screen.getByText('order_abc123')).toBeInTheDocument();
      expect(screen.getByText(/1[.,]500[.,]000/)).toBeInTheDocument();
    });

    const momoBtn = screen.getByRole('button', { name: /Thanh toán bằng MoMo/i });
    expect(momoBtn).toBeDisabled();
    expect(momoBtn).toHaveTextContent('Thanh toán bằng MoMo (Bảo trì)');

    const vnpayBtn = screen.getByRole('button', { name: /Thanh toán bằng VNPAY/i });
    expect(vnpayBtn).not.toBeDisabled();
  });

  it('triggers payment redirection successfully on button press', async () => {
    vi.spyOn(apiClient, 'request')
      .mockResolvedValueOnce({
        id: 'order_abc123',
        totalAmount: 1500000,
        createdAt: activeBookingCreatedAt(),
        status: 'pending',
      })
      .mockResolvedValueOnce({
        momo: 'CLOSED',
        vnpay: 'CLOSED',
      })
      .mockResolvedValueOnce({
        payUrl: 'https://sandbox.vnpayment.vn/payment-redirect',
      });

    render(
      <MemoryRouter initialEntries={['/checkout/order_abc123']}>
        <Routes>
          <Route path="/checkout/:orderId" element={<CheckoutPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Thanh toán')).toBeInTheDocument();
    });

    const vnpayBtn = screen.getByRole('button', { name: /Thanh toán bằng VNPAY/i });
    fireEvent.click(vnpayBtn);

    await waitFor(() => {
      expect(window.location.href).toBe('https://sandbox.vnpayment.vn/payment-redirect');
    });
  });

  it('shows a friendly retry message when the selected gateway cannot create a new payment', async () => {
    vi.spyOn(apiClient, 'request')
      .mockResolvedValueOnce({
        id: 'order_abc123',
        totalAmount: 1500000,
        createdAt: activeBookingCreatedAt(),
        status: 'pending',
      })
      .mockResolvedValueOnce({
        momo: 'CLOSED',
        vnpay: 'CLOSED',
      })
      .mockRejectedValueOnce({
        statusCode: 503,
        message: 'MoMo payment failed: Lỗi: Đơn hàng đã bị huỷ bỏ',
      });

    render(
      <MemoryRouter initialEntries={['/checkout/order_abc123']}>
        <Routes>
          <Route path="/checkout/:orderId" element={<CheckoutPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Thanh toán')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Thanh toán bằng MoMo/i }));

    await waitFor(() => {
      expect(screen.getByText(/MoMo chưa thể tạo giao dịch mới cho đơn này/i)).toBeInTheDocument();
      expect(screen.getByText(/thử VNPAY hoặc quay lại chọn vé mới/i)).toBeInTheDocument();
    });
  });

  it('blocks payment when pending booking does not include a usable hold time', async () => {
    vi.spyOn(apiClient, 'request')
      .mockResolvedValueOnce({
        id: 'order_pending',
        totalAmount: 6000000,
        createdAt: 'not-a-date',
        status: 'pending',
      })
      .mockResolvedValueOnce({
        momo: 'CLOSED',
        vnpay: 'CLOSED',
      });

    render(
      <MemoryRouter initialEntries={['/checkout/order_pending']}>
        <Routes>
          <Route path="/checkout/:orderId" element={<CheckoutPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Thanh toán')).toBeInTheDocument();
      expect(screen.getByText(/Không xác định được thời gian giữ vé/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Thanh toán bằng MoMo/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Thanh toán bằng VNPAY/i })).toBeDisabled();
  });
});
