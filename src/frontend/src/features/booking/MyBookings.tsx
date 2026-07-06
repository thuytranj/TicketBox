import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as QRCode from 'qrcode';
import { apiClient } from '../../api/client';
import {
  Ticket,
  CalendarDays,
  MapPin,
  ChevronLeft,
  ChevronRight,
  QrCode,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  AlertTriangle,
  CreditCard
} from 'lucide-react';
import heroPreview from '../../assets/hero.png';

interface TicketTypeData {
  id: string;
  name: string;
  price: number;
}

interface TicketData {
  id: string;
  ticketTypeId: string;
  qrCodeHash: string | null;
  status: 'active' | 'cancelled' | 'refunded';
  checkinStatus: 'not_checked_in' | 'checked_in';
  checkedInAt: string | null;
  ticketType?: TicketTypeData;
}

interface ConcertData {
  id: string;
  title: string;
  location: string;
  posterUrl: string;
  startTime: string;
  endTime: string;
  status: 'draft' | 'active' | 'cancelled';
  tags: string[];
}

interface OrderData {
  id: string;
  userId: string;
  concertId: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  totalAmount: number;
  idempotencyKey: string;
  createdAt: string;
  tickets?: TicketData[];
  concert?: ConcertData;
}

interface BookingsResponse {
  data: OrderData[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Sub-component to render QR code dynamically
const QRCodeImage: React.FC<{ value: string }> = ({ value }) => {
  const [qrUrl, setQrUrl] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 220,
    })
      .then((url) => {
        if (active) setQrUrl(url);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [value]);

  if (error) {
    return (
      <div className="flex-center" style={{ width: 220, height: 220, border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--danger)' }}>
        <AlertTriangle size={32} />
        <span style={{ fontSize: '0.8rem', marginTop: 8 }}>Lỗi tạo mã QR</span>
      </div>
    );
  }

  if (!qrUrl) {
    return (
      <div className="flex-center" style={{ width: 220, height: 220, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <img
      src={qrUrl}
      alt="QR Ticket"
      style={{ display: 'block', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}
      width="220"
      height="220"
    />
  );
};

export const MyBookings: React.FC = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<OrderData[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'paid' | 'pending' | 'cancelled_expired'>('all');
  const [timeTab, setTimeTab] = useState<'upcoming' | 'ended'>('upcoming');
  const [page, setPage] = useState(1);
  const itemsPerPage = 5;

  // Modal Wallet states
  const [selectedOrderForTickets, setSelectedOrderForTickets] = useState<OrderData | null>(null);
  const [currentTicketIndex, setCurrentTicketIndex] = useState(0);

  const fetchBookings = async () => {
    setLoading(true);
    setError('');
    try {
      const limitVal = 50;

      if (activeTab === 'cancelled_expired') {
        // Fetch cancelled and expired in parallel (single call each, limit 50)
        const [resCancelled, resExpired] = await Promise.all([
          apiClient.request<BookingsResponse>(`/bookings?page=1&limit=${limitVal}&status=cancelled`),
          apiClient.request<BookingsResponse>(`/bookings?page=1&limit=${limitVal}&status=expired`),
        ]);

        const merged = [...(resCancelled.data || []), ...(resExpired.data || [])].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        setBookings(merged);
      } else {
        const statusFilter = activeTab === 'all' ? undefined : activeTab;
        let url = `/bookings?page=1&limit=${limitVal}`;
        if (statusFilter) {
          url += `&status=${statusFilter}`;
        }
        const response = await apiClient.request<BookingsResponse>(url);
        setBookings(response.data || []);
      }
    } catch (err: any) {
      setError(err.message || 'Không tải được danh sách vé của bạn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [activeTab]);

  // Handle client-side filtering when bookings data or timeline changes
  useEffect(() => {
    const now = new Date();
    const filtered = bookings.filter((order) => {
      const concert = order.concert;
      if (!concert) return false;
      const concertTime = new Date(concert.endTime || concert.startTime);
      if (timeTab === 'upcoming') {
        return concertTime >= now;
      } else {
        return concertTime < now;
      }
    });
    setFilteredBookings(filtered);
    setPage(1); // Always reset page to 1 when changing timeline filters
  }, [bookings, timeTab]);

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
  };

  const handleTimeTabChange = (tab: typeof timeTab) => {
    setTimeTab(tab);
  };

  const openTicketWallet = (order: OrderData) => {
    if (order.tickets && order.tickets.length > 0) {
      setSelectedOrderForTickets(order);
      setCurrentTicketIndex(0);
    }
  };

  const closeTicketWallet = () => {
    setSelectedOrderForTickets(null);
  };

  const getOrderStatusBadge = (status: OrderData['status']) => {
    switch (status) {
      case 'paid':
        return (
          <span className="badge-pill" style={{ background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', fontWeight: 700, padding: '4px 12px', borderRadius: '99px', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Đã thanh toán
          </span>
        );
      case 'pending':
        return (
          <span className="badge-pill" style={{ background: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)', fontWeight: 700, padding: '4px 12px', borderRadius: '99px', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Chờ thanh toán
          </span>
        );
      case 'cancelled':
        return (
          <span className="badge-pill" style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', fontWeight: 700, padding: '4px 12px', borderRadius: '99px', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Đã hủy
          </span>
        );
      case 'expired':
        return (
          <span className="badge-pill" style={{ background: 'rgba(100, 116, 139, 0.08)', color: '#64748b', border: '1px solid rgba(100, 116, 139, 0.2)', fontWeight: 700, padding: '4px 12px', borderRadius: '99px', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Đã hết hạn
          </span>
        );
      default:
        return <span className="badge-pill" style={{ borderRadius: '99px', padding: '4px 12px' }}>{status}</span>;
    }
  };

  // Pagination calculated based on the fully filtered list
  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage) || 1;
  const paginatedBookings = filteredBookings.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div className="container" style={{ minHeight: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', paddingBottom: '3rem' }}>
      <Link to="/" className="btn btn-outline" style={{ alignSelf: 'flex-start', marginBottom: '1.5rem', gap: '0.5rem' }}>
        <ArrowLeft size={16} /> Quay lại trang chủ
      </Link>

      <header className="section-heading" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Vé của tôi</h1>
        </div>
      </header>

      {/* Primary Capsule Tabs for Status */}
      <div className="booking-tabs-container">
        <button
          className={`booking-tab-pill ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => handleTabChange('all')}
        >
          Tất cả
        </button>
        <button
          className={`booking-tab-pill ${activeTab === 'paid' ? 'active' : ''}`}
          onClick={() => handleTabChange('paid')}
        >
          Thành công
        </button>
        <button
          className={`booking-tab-pill ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => handleTabChange('pending')}
        >
          Đang xử lý
        </button>
        <button
          className={`booking-tab-pill ${activeTab === 'cancelled_expired' ? 'active' : ''}`}
          onClick={() => handleTabChange('cancelled_expired')}
        >
          Đã hủy
        </button>
      </div>

      {/* Secondary Underline Tabs for Time */}
      <div className="booking-time-tabs">
        <button
          className={`booking-time-tab ${timeTab === 'upcoming' ? 'active' : ''}`}
          onClick={() => handleTimeTabChange('upcoming')}
        >
          Sắp diễn ra
        </button>
        <button
          className={`booking-time-tab ${timeTab === 'ended' ? 'active' : ''}`}
          onClick={() => handleTimeTabChange('ended')}
        >
          Đã kết thúc
        </button>
      </div>

      {loading ? (
        <div className="flex-center" style={{ flex: 1, padding: '4rem 0' }}>
          <div className="spinner" />
          <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Đang tải danh sách vé...</p>
        </div>
      ) : error ? (
        <div className="alert alert-danger" style={{ margin: '2rem 0' }}>{error}</div>
      ) : bookings.length === 0 ? (
        <div className="empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '4rem 0' }}>
          <Ticket size={48} style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }} />
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Không có vé phù hợp</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', textAlign: 'center' }}>
            Bạn chưa có giao dịch nào {timeTab === 'upcoming' ? 'sắp diễn ra' : 'đã kết thúc'} ở trạng thái này.
          </p>
          <Link to="/concerts" className="btn btn-primary">
            Khám phá sự kiện
          </Link>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '4rem 0' }}>
          <Ticket size={48} style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }} />
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Không có vé phù hợp</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', textAlign: 'center' }}>
            Bạn chưa có giao dịch nào {timeTab === 'upcoming' ? 'sắp diễn ra' : 'đã kết thúc'} ở trạng thái này.
          </p>
          <Link to="/concerts" className="btn btn-primary">
            Khám phá sự kiện
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
          {paginatedBookings.map((order) => {
            const concert = order.concert;
            if (!concert) return null;

            return (
              <div key={order.id} className="booking-card">
                {/* Concert Poster Section */}
                <div className="booking-card-poster">
                  <img
                    src={concert.posterUrl || heroPreview}
                    alt={concert.title}
                  />
                </div>

                {/* Main Order Details Section */}
                <div className="booking-card-body">
                  <div>
                    <div className="flex-between" style={{ marginBottom: '0.75rem', alignItems: 'flex-start', gap: '1rem' }}>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-strong)', margin: 0, lineHeight: 1.3 }}>{concert.title}</h3>
                      {getOrderStatusBadge(order.status)}
                    </div>

                    <div className="meta-list" style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '1rem', fontSize: '0.82rem' }}>
                      <span className="meta-item" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                        <CalendarDays size={14} style={{ color: 'var(--primary)' }} />
                        {new Date(concert.startTime).toLocaleDateString('vi-VN')} {new Date(concert.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="meta-item" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                        <MapPin size={14} style={{ color: 'var(--primary)' }} />
                        {concert.location}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', background: 'var(--surface-alt)', padding: '6px 12px', borderRadius: '8px', display: 'inline-block' }}>
                      Mã đơn hàng: <strong style={{ color: 'var(--text-strong)', fontFamily: 'monospace', fontSize: '0.88rem' }}>{order.id.slice(0, 8).toUpperCase()}...</strong>
                      <span style={{ margin: '0 0.75rem', opacity: 0.5 }}>|</span>
                      Ngày đặt: <strong>{new Date(order.createdAt).toLocaleDateString('vi-VN')}</strong>
                    </div>
                  </div>

                  <div className="flex-between" style={{ marginTop: '1.25rem', flexWrap: 'wrap', gap: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                    <div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Tổng thanh toán</span>
                      <strong style={{ display: 'block', fontSize: '1.3rem', color: 'var(--text-strong)', fontWeight: 800, marginTop: '2px' }}>
                        {order.totalAmount.toLocaleString()} VND
                      </strong>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      {order.status === 'paid' && order.tickets && order.tickets.length > 0 && (
                        <button
                          onClick={() => openTicketWallet(order)}
                          className="btn btn-primary"
                          style={{ gap: '0.5rem', padding: '10px 18px', fontWeight: 700, borderRadius: '8px', fontSize: '0.88rem' }}
                        >
                          <QrCode size={16} /> Xem vé & mã QR
                        </button>
                      )}
                      {order.status === 'pending' && (
                        <button
                          onClick={() => navigate(`/checkout/${order.id}`)}
                          className="btn btn-outline"
                          style={{ gap: '0.5rem', padding: '10px 18px', fontWeight: 700, borderRadius: '8px', fontSize: '0.88rem', borderColor: 'var(--warning)', color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.03)' }}
                        >
                          <CreditCard size={16} /> Thanh toán ngay
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination-bar" style={{ marginTop: '2rem' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft size={16} /> Trước
              </button>
              <span>Trang <strong>{page}</strong> / {totalPages}</span>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Sau <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Ticket Wallet Modal */}
      {selectedOrderForTickets && selectedOrderForTickets.tickets && (
        (() => {
          const tickets = selectedOrderForTickets.tickets;
          const ticket = tickets[currentTicketIndex];
          const concert = selectedOrderForTickets.concert!;
          const ticketTypeName = ticket.ticketType?.name || 'Vé phổ thông';
          const isCheckedIn = ticket.checkinStatus === 'checked_in';

          return (
            <div className="modal-backdrop" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000, padding: '1rem' }} onClick={closeTicketWallet}>
              <div
                className="card"
                style={{ width: '420px', maxWidth: '100%', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header Ticket Modal */}
                <div style={{ backgroundColor: 'var(--surface-alt)', padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Ticket size={20} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Ví vé soát cửa</span>
                  </div>
                  <button
                    onClick={closeTicketWallet}
                    className="btn btn-ghost"
                    style={{ minWidth: 'auto', padding: '0.25rem', height: 'auto', borderRadius: '50%' }}
                    aria-label="Đóng ví vé"
                  >
                    <XCircle size={22} style={{ color: 'var(--text-muted)' }} />
                  </button>
                </div>

                <div className="card-body" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {/* Slider indicator if multiple tickets */}
                  {tickets.length > 1 && (
                    <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem' }}>
                      {tickets.map((_, idx) => (
                        <div
                          key={idx}
                          style={{
                            width: idx === currentTicketIndex ? '16px' : '6px',
                            height: '6px',
                            borderRadius: '3px',
                            backgroundColor: idx === currentTicketIndex ? 'var(--accent)' : 'var(--border)',
                            transition: 'all 0.2s ease'
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* QR Image */}
                  <div style={{ padding: '0.5rem', backgroundColor: '#ffffff', borderRadius: 'var(--radius-lg)', marginBottom: '1.25rem', boxShadow: 'var(--shadow-premium)' }}>
                    {ticket.qrCodeHash ? (
                      <QRCodeImage value={ticket.qrCodeHash} />
                    ) : (
                      <div className="flex-center" style={{ width: 220, height: 220, color: 'var(--text-muted)' }}>
                        Chưa cấu hình mã QR
                      </div>
                    )}
                  </div>

                  {/* Ticket Zone Info */}
                  <div style={{ textAlign: 'center', marginBottom: '1rem', width: '100%' }}>
                    <span className="badge" style={{ backgroundColor: 'var(--accent)', color: 'white', padding: '0.35rem 0.85rem', fontSize: '0.95rem', fontWeight: 700, borderRadius: '20px' }}>
                      {ticketTypeName}
                    </span>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.75rem 0 0.25rem 0' }}>{concert.title}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>{concert.location}</p>
                  </div>

                  {/* Checkin Status & Info */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      width: '100%',
                      padding: '0.85rem',
                      backgroundColor: isCheckedIn ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${isCheckedIn ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                      marginBottom: '1rem'
                    }}
                  >
                    {isCheckedIn ? (
                      <>
                        <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
                        <div style={{ textAlign: 'left', fontSize: '0.82rem' }}>
                          <strong style={{ color: 'var(--success)' }}>ĐÃ SOÁT VÉ (Checked In)</strong>
                          {ticket.checkedInAt && (
                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Lúc {new Date(ticket.checkedInAt).toLocaleString('vi-VN')}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <Clock size={18} style={{ color: 'var(--danger)' }} />
                        <div style={{ textAlign: 'left', fontSize: '0.82rem' }}>
                          <strong style={{ color: 'var(--danger)' }}>CHƯA SOÁT VÉ (Not Checked In)</strong>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Xuất trình mã QR tại cổng soát vé để vào.
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Slider Control buttons */}
                  {tickets.length > 1 && (
                    <div className="flex-between" style={{ width: '100%', marginTop: '0.5rem' }}>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', gap: '0.25rem' }}
                        disabled={currentTicketIndex === 0}
                        onClick={() => setCurrentTicketIndex((prev) => prev - 1)}
                      >
                        <ChevronLeft size={14} /> Vé trước
                      </button>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Vé {currentTicketIndex + 1} / {tickets.length}
                      </span>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', gap: '0.25rem' }}
                        disabled={currentTicketIndex === tickets.length - 1}
                        onClick={() => setCurrentTicketIndex((prev) => prev + 1)}
                      >
                        Vé sau <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
};
