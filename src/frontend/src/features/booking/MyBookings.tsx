import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
  CreditCard,
  Copy,
  Check
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

const formatConcertTime = (startTimeStr: string) => {
  try {
    const date = new Date(startTimeStr);
    const weekdays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const weekday = weekdays[date.getDay()];
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${weekday}, ${day}/${month}/${year} • ${hours}:${minutes}`;
  } catch {
    return new Date(startTimeStr).toLocaleString('vi-VN');
  }
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
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // Modal Wallet states (Derived from searchParams to support browser back button navigation)
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedOrderForTickets = bookings.find((o) => o.id === searchParams.get('wallet')) || null;
  const [currentTicketIndex, setCurrentTicketIndex] = useState(0);

  const handleCopyOrderId = (orderId: string) => {
    navigator.clipboard.writeText(orderId).then(() => {
      setCopiedOrderId(orderId);
      setTimeout(() => setCopiedOrderId(null), 2000);
    });
  };

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
      setCurrentTicketIndex(0);
      const newParams = new URLSearchParams(searchParams);
      newParams.set('wallet', order.id);
      setSearchParams(newParams);
    }
  };

  const closeTicketWallet = () => {
    const newParams = new URLSearchParams(searchParams);
    if (newParams.has('wallet')) {
      newParams.delete('wallet');
      setSearchParams(newParams);
    }
  };

  const getOrderStatusBadge = (status: OrderData['status']) => {
    const config = {
      paid: { text: 'Đã thanh toán', color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.2)' },
      pending: { text: 'Chờ thanh toán', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.2)' },
      cancelled: { text: 'Đã hủy', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)' },
      expired: { text: 'Đã hết hạn', color: '#64748b', bg: 'rgba(100, 116, 139, 0.08)', border: 'rgba(100, 116, 139, 0.2)' },
    }[status] || { text: status, color: 'var(--text-muted)', bg: 'var(--surface-alt)', border: 'var(--border)' };

    return (
      <span className="badge-pill" style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        fontWeight: 700,
        padding: '4px 12px',
        borderRadius: '99px',
        fontSize: '0.72rem',
        letterSpacing: '0.05em',
        textTransform: 'uppercase'
      }}>
        <span style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: config.color,
          display: 'inline-block'
        }} />
        {config.text}
      </span>
    );
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
                {/* 1. Header Strip (full width) */}
                <div className="booking-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>Mã đơn:</span>
                    <span style={{
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      color: 'var(--text-strong)',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '160px',
                    }}>
                      #{order.id.slice(0, 16).toUpperCase()}...
                    </span>
                    <button
                      onClick={() => handleCopyOrderId(order.id)}
                      title="Sao chép mã đơn hàng"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        border: 'none',
                        borderRadius: '6px',
                        background: copiedOrderId === order.id ? 'rgba(16,185,129,0.12)' : 'transparent',
                        color: copiedOrderId === order.id ? '#10b981' : 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        flexShrink: 0,
                        padding: 0,
                      }}
                      onMouseEnter={e => { if (copiedOrderId !== order.id) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.06)'; }}
                      onMouseLeave={e => { if (copiedOrderId !== order.id) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                    >
                      {copiedOrderId === order.id ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                    {copiedOrderId === order.id && (
                      <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600, whiteSpace: 'nowrap', animation: 'fadeIn 0.2s ease' }}>
                        Đã sao chép!
                      </span>
                    )}
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {getOrderStatusBadge(order.status)}
                  </div>
                </div>

                {/* 2. Card Body (containing Poster on left + Info on right) */}
                <div className="booking-card-body">
                  <div className="booking-card-poster">
                    <img
                      src={concert.posterUrl || heroPreview}
                      alt={concert.title}
                    />
                  </div>

                  <div className="booking-card-info">
                    <h3 className="booking-card-title">{concert.title}</h3>
                    
                    <div className="booking-card-divider" />

                    <div className="booking-card-meta">
                      <span className="meta-item">
                        <CalendarDays size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                        <span>{formatConcertTime(concert.startTime)}</span>
                      </span>
                      <span className="meta-item">
                        <MapPin size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                        <span>{concert.location}</span>
                      </span>
                      <span className="meta-item">
                        <Ticket size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                        <span>Số lượng: {order.tickets?.length || 0} vé ({order.tickets?.[0]?.ticketType?.name || 'Vé'})</span>
                      </span>
                    </div>

                    <div className="booking-card-price-row">
                      <span>Tổng tiền:</span>
                      <strong>{order.totalAmount.toLocaleString()} VND</strong>
                    </div>
                  </div>
                </div>

                {/* 3. Card Footer (containing buttons) */}
                <div className="booking-card-footer">
                  <Link
                    to={`/concerts/${concert.id}`}
                    className="btn btn-outline"
                    style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    Chi tiết sự kiện
                  </Link>

                  {order.status === 'paid' && order.tickets && order.tickets.length > 0 && (
                    <button
                      onClick={() => openTicketWallet(order)}
                      className="btn btn-primary"
                      style={{ gap: '0.5rem', padding: '8px 18px', fontWeight: 700, borderRadius: '8px', fontSize: '0.85rem' }}
                    >
                      <QrCode size={16} /> Xem vé &amp; mã QR
                    </button>
                  )}
                  {order.status === 'pending' && (
                    <button
                      onClick={() => navigate(`/checkout/${order.id}`)}
                      className="btn btn-primary"
                      style={{ gap: '0.5rem', padding: '8px 18px', fontWeight: 700, borderRadius: '8px', fontSize: '0.85rem', background: 'var(--warning)', borderColor: 'var(--warning)', color: '#fff' }}
                    >
                      <CreditCard size={16} /> Thanh toán ngay
                    </button>
                  )}
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
