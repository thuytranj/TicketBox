import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { CheckCircle, XCircle, Clock, ArrowLeft, RefreshCw } from 'lucide-react';

interface TicketTypeData {
  id: string;
  name: string;
  price: number;
}

interface TicketData {
  id: string;
  ticketTypeId: string;
  qrCodeHash: string | null;
  qrCode?: string | null; // fallback for tests
  status: string;
  checkinStatus: string;
  ticketType?: TicketTypeData;
}

interface BookingDetails {
  id: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  totalAmount: number;
  tickets?: TicketData[];
}

export const PaymentCallback: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [status, setStatus] = useState<'processing' | 'success' | 'failed' | 'timeout'>('processing');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [retryTrigger, setRetryTrigger] = useState(0);

  useEffect(() => {
    let active = true;
    let pollCount = 0;
    const maxPollAttempts = 15; // 30 seconds max polling
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const fetchStatus = async () => {
      try {
        const response = await apiClient.request<BookingDetails>(`/bookings/${orderId}`);
        if (!active) return true; // Stop if unmounted
        setBooking(response);
        
        if (response.status === 'paid') {
          setStatus('success');
          setLoading(false);
          return true; // Stop polling
        } else if (response.status === 'expired' || response.status === 'cancelled') {
          setStatus('failed');
          setLoading(false);
          return true; // Stop polling
        } else if (response.status === 'pending') {
          pollCount += 1;
          if (pollCount >= maxPollAttempts) {
            setStatus('timeout');
            setLoading(false);
            return true; // Stop polling
          }
        }
        return false; // Keep polling
      } catch (err: unknown) {
        if (!active) return true;
        const errMsg = err instanceof Error ? err.message : 'Failed to load booking status';
        setError(errMsg);
        setStatus('failed');
        setLoading(false);
        return true; // Stop polling
      }
    };

    const runPoll = async () => {
      const stop = await fetchStatus();
      if (stop || !active) return;

      intervalId = setInterval(async () => {
        const stopPoll = await fetchStatus();
        if (stopPoll && intervalId) {
          clearInterval(intervalId);
        }
      }, 2000);
    };

    void runPoll();

    return () => {
      active = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [orderId, retryTrigger]);

  if (loading && status === 'processing') {
    return (
      <div className="flex-center" style={{ padding: 64, minHeight: '50dvh', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="spinner" />
        <p style={{ color: 'var(--text-muted)' }}>Đang xác thực giao dịch thanh toán... / Verifying your payment transaction...</p>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="container-narrow">
        <div className="alert alert-danger">{error}</div>
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <button onClick={() => navigate('/')} className="btn btn-primary">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-narrow">
      <div className="card state-card">
        <div className="card-body" style={{ padding: '3rem 2rem' }}>
          {status === 'success' && booking && (
            <div>
              <div className="flex-center" style={{ marginBottom: '1.5rem' }}>
                <CheckCircle size={64} style={{ color: 'var(--success)' }} />
              </div>
              <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'var(--success)' }}>
                Thanh toán thành công! / Payment Successful!
              </h1>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
                Vé của bạn đã được xác nhận và kích hoạt. Hãy xuất trình mã QR bên dưới khi check-in tại sự kiện.
                (Your tickets are confirmed and activated. Present the QR code below at the event gate.)
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
                {booking.tickets && booking.tickets.map((t) => {
                  const qrHash = t.qrCodeHash || t.qrCode;
                  return (
                    <div
                      key={t.id}
                      className="card"
                      style={{
                        border: '2px dashed var(--border)',
                        padding: '2rem',
                        borderRadius: 'var(--radius)',
                        backgroundColor: 'var(--surface-alt)',
                        width: '100%',
                        maxWidth: '320px',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      <strong style={{ display: 'block', fontSize: '1.25rem', color: 'var(--text-strong)', marginBottom: '0.25rem' }}>
                        VÉ ĐIỆN TỬ / E-TICKET
                      </strong>
                      <span style={{ display: 'block', color: 'var(--primary)', fontWeight: 800, marginBottom: '1.5rem', textTransform: 'uppercase' }}>
                        Hạng: {t.ticketType?.name || 'General Admission'}
                      </span>
                      
                      {qrHash ? (
                        <div style={{ background: '#fff', padding: '1rem', borderRadius: 'var(--radius-sm)', display: 'inline-block', margin: '0 auto' }}>
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrHash)}`}
                            alt="QR Code"
                            aria-label="QR Code"
                            width="200"
                            height="200"
                            style={{ display: 'block' }}
                          />
                        </div>
                      ) : (
                        <div style={{ padding: '2rem', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                          QR Code is generating...
                        </div>
                      )}
                      
                      <div style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span><strong>Mã vé / ID:</strong> {t.id}</span>
                        <span><strong>Trạng thái / Status:</strong> {t.status}</span>
                        <span><strong>Soát vé / Check-in:</strong> {t.checkinStatus === 'checked_in' ? 'Đã soát / Checked In' : 'Chưa soát / Not Checked In'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {status === 'failed' && (
            <div>
              <div className="flex-center" style={{ marginBottom: '1.5rem' }}>
                <XCircle size={64} style={{ color: 'var(--danger)' }} />
              </div>
              <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'var(--danger)' }}>
                Thanh toán thất bại hoặc hết hạn / Payment Failed or Expired
              </h1>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
                Đơn hàng của bạn đã bị hủy hoặc thời gian giữ chỗ đã hết hạn. Nếu tài khoản của bạn đã bị trừ tiền, vui lòng liên hệ Ban tổ chức để được hỗ trợ đối soát.
                (Your order has been cancelled or expired. If you have been charged, please contact support.)
              </p>
            </div>
          )}

          {status === 'timeout' && (
            <div>
              <div className="flex-center" style={{ marginBottom: '1.5rem', color: 'var(--warning)' }}>
                <Clock size={64} />
              </div>
              <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'var(--warning)' }}>
                Giao dịch đang chờ xác nhận / Payment Status Pending
              </h1>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
                Hệ thống chưa nhận được phản hồi xác nhận từ cổng thanh toán. Trạng thái giao dịch sẽ được cập nhật tự động. Vui lòng kiểm tra email của bạn sau ít phút hoặc xem lịch sử đơn hàng.
                (We are waiting for payment confirmation. Status will update shortly. Please check your email or order history.)
              </p>
            </div>
          )}

          <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              onClick={() => navigate('/')}
              className="btn btn-outline"
              style={{ minWidth: 150, gap: '0.5rem' }}
            >
              <ArrowLeft size={16} /> Về trang chủ / Home
            </button>
            
            {status === 'timeout' && (
              <button
                onClick={() => {
                  setLoading(true);
                  setStatus('processing');
                  setRetryTrigger((prev) => prev + 1);
                }}
                className="btn btn-primary"
                style={{ minWidth: 150, gap: '0.5rem' }}
              >
                <RefreshCw size={16} /> Thử lại / Refresh
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
