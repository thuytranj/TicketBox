import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MyBookings } from '../../../features/booking/MyBookings';
import { apiClient } from '../../../api/client';

vi.mock('../../../api/client', () => ({
  apiClient: {
    request: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('MyBookings', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockClear();
  });

  it('renders the bookings title, tabs and empty state when user has no bookings', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 5, totalPages: 0 },
    });

    render(
      <MemoryRouter>
        <MyBookings />
      </MemoryRouter>
    );

    expect(screen.getByText('Vé của tôi')).toBeInTheDocument();
    expect(screen.getByText('Tất cả')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Không có vé phù hợp')).toBeInTheDocument();
      expect(screen.getByText(/Bạn chưa có giao dịch nào/i)).toBeInTheDocument();
    });
  });

  it('renders bookings list with paid and pending orders correctly', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue({
      data: [
        {
          id: 'order_paid_id',
          userId: 'u1',
          concertId: 'c1',
          status: 'paid',
          totalAmount: 1500000,
          idempotencyKey: 'idemp-1',
          createdAt: '2026-07-01T10:00:00Z',
          tickets: [
            {
              id: 'ticket1_id',
              ticketTypeId: 'tt1',
              qrCodeHash: 'qr_hash_code_123',
              status: 'active',
              checkinStatus: 'not_checked_in',
              checkedInAt: null,
              ticketType: { id: 'tt1', name: 'VIP', price: 1500000 },
            }
          ],
          concert: {
            id: 'c1',
            title: 'KOSMIK Live Concert',
            location: 'Nha thi dau Phu Tho',
            posterUrl: '',
            startTime: '2026-08-01T19:00:00Z',
            endTime: '2026-08-01T23:00:00Z',
            status: 'active',
            tags: ['rap'],
          }
        },
        {
          id: 'order_pending_id',
          userId: 'u1',
          concertId: 'c2',
          status: 'pending',
          totalAmount: 800000,
          idempotencyKey: 'idemp-2',
          createdAt: '2026-07-02T12:00:00Z',
          tickets: [
            {
              id: 'ticket2_id',
              ticketTypeId: 'tt2',
              qrCodeHash: null,
              status: 'active',
              checkinStatus: 'not_checked_in',
              checkedInAt: null,
              ticketType: { id: 'tt2', name: 'GA', price: 800000 },
            }
          ],
          concert: {
            id: 'c2',
            title: 'Rock Storm 2026',
            location: 'San van dong My Dinh',
            posterUrl: '',
            startTime: '2026-09-01T18:00:00Z',
            endTime: '2026-09-01T22:00:00Z',
            status: 'active',
            tags: ['rock'],
          }
        }
      ],
      meta: { total: 2, page: 1, limit: 5, totalPages: 1 },
    });

    render(
      <MemoryRouter>
        <MyBookings />
      </MemoryRouter>
    );

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByText('KOSMIK Live Concert')).toBeInTheDocument();
      expect(screen.getByText('Rock Storm 2026')).toBeInTheDocument();
    });

    // Check status badges
    expect(screen.getByText('Đã thanh toán')).toBeInTheDocument();
    expect(screen.getByText('Chờ thanh toán')).toBeInTheDocument();
    expect(screen.getByText('Đang xử lý')).toBeInTheDocument();

    // Check actions buttons
    expect(screen.getByText('Xem vé & mã QR')).toBeInTheDocument();
    expect(screen.getByText('Thanh toán ngay')).toBeInTheDocument();

    // Click "Thanh toán ngay"
    fireEvent.click(screen.getByText('Thanh toán ngay'));
    expect(mockNavigate).toHaveBeenCalledWith('/checkout/order_pending_id');
  });

  it('opens and closes the ticket wallet modal with QR code and check-in details', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue({
      data: [
        {
          id: 'order_paid_id',
          userId: 'u1',
          concertId: 'c1',
          status: 'paid',
          totalAmount: 1500000,
          idempotencyKey: 'idemp-1',
          createdAt: '2026-07-01T10:00:00Z',
          tickets: [
            {
              id: 'ticket1_id',
              ticketTypeId: 'tt1',
              qrCodeHash: 'qr_hash_code_123',
              status: 'active',
              checkinStatus: 'not_checked_in',
              checkedInAt: null,
              ticketType: { id: 'tt1', name: 'VIP', price: 1500000 },
            }
          ],
          concert: {
            id: 'c1',
            title: 'KOSMIK Live Concert',
            location: 'Nha thi dau Phu Tho',
            posterUrl: '',
            startTime: '2026-08-01T19:00:00Z',
            endTime: '2026-08-01T23:00:00Z',
            status: 'active',
            tags: ['rap'],
          }
        }
      ],
      meta: { total: 1, page: 1, limit: 5, totalPages: 1 },
    });

    render(
      <MemoryRouter>
        <MyBookings />
      </MemoryRouter>
    );

    // Wait for data load and click QR button
    await screen.findByText('KOSMIK Live Concert');
    fireEvent.click(screen.getByText('Xem vé & mã QR'));

    // Modal opens
    expect(screen.getByText('Ví vé soát cửa')).toBeInTheDocument();
    expect(screen.getByText('CHƯA SOÁT VÉ (Not Checked In)')).toBeInTheDocument();
    expect(screen.getByText('VIP')).toBeInTheDocument();

    // Close button
    fireEvent.click(screen.getByLabelText('Đóng ví vé'));
    expect(screen.queryByText('Ví vé soát cửa')).toBeNull();
  });
});
