import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { Clock, CreditCard, Ticket, AlertTriangle } from 'lucide-react';

interface CircuitBreakerStatus {
  momo: 'CLOSED' | 'OPEN' | 'HALF-OPEN';
  vnpay: 'CLOSED' | 'OPEN' | 'HALF-OPEN';
}

interface BookingData {
  id: string;
  totalAmount: number;
  createdAt: string;
  status: string;
}

export const CheckoutPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [cbStatus, setCbStatus] = useState<CircuitBreakerStatus>({ momo: 'CLOSED', vnpay: 'CLOSED' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Hold countdown timer states
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const loadCheckoutData = async () => {
      try {
        const [bookingRes, cbRes] = await Promise.all([
          apiClient.request<BookingData>(`/bookings/${orderId}`),
          apiClient.request<CircuitBreakerStatus>('/payments/circuit-breaker/status').catch((): CircuitBreakerStatus => ({ momo: 'CLOSED', vnpay: 'CLOSED' })),
        ]);

        setBooking(bookingRes);
        setCbStatus(cbRes);
        
        // If booking is already expired/cancelled/paid, mark appropriate flags
        if (bookingRes.status === 'expired' || bookingRes.status === 'cancelled') {
          setIsExpired(true);
          setTimeLeft(0);
        } else {
          // Calculate remaining seconds
          const expiresTime = new Date(bookingRes.createdAt).getTime() + 10 * 60 * 1000;
          const initialTimeLeft = Math.max(0, Math.floor((expiresTime - Date.now()) / 1000));
          setTimeLeft(initialTimeLeft);
          if (initialTimeLeft === 0) {
            setIsExpired(true);
          }
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Failed to load checkout details';
        setError(errMsg);
      } finally {
        setLoading(false);
      }
    };

    loadCheckoutData();
  }, [orderId]);

  // Timer countdown loop
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || isExpired || !booking) return;

    const interval = setInterval(() => {
      const expiresTime = new Date(booking.createdAt).getTime() + 10 * 60 * 1000;
      const secondsRemaining = Math.max(0, Math.floor((expiresTime - Date.now()) / 1000));
      
      setTimeLeft(secondsRemaining);
      
      if (secondsRemaining <= 0) {
        setIsExpired(true);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [booking, timeLeft, isExpired]);

  const handlePayment = async (gateway: 'momo' | 'vnpay') => {
    if (isExpired) return;
    setSubmitting(true);
    setError('');
    try {
      const idempotencyKey = crypto.randomUUID();
      const response = await apiClient.request<{ payUrl: string }>(`/payments/${gateway}`, {
        method: 'POST',
        headers: {
          'idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          orderId: orderId,
          orderInfo: `Pay for TicketBox booking ${orderId}`,
        }),
      });

      if (response.payUrl) {
        window.location.href = response.payUrl;
      } else {
        throw new Error('No redirect URL returned by gateway');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Payment initiation failed. Please try another method.';
      setError(errMsg);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-center" style={{ padding: 64, minHeight: '50dvh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="container-narrow">
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  const allGatewaysOffline = cbStatus.momo === 'OPEN' && cbStatus.vnpay === 'OPEN';
  
  // Format MM:SS
  const formatTimeLeft = (totalSeconds: number | null) => {
    if (totalSeconds === null) return '--:--';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container-narrow">
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {isExpired && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={20} />
          <span>Thời gian giữ vé đã hết hạn. Vui lòng quay lại chọn vé mới. / Your ticket hold reservation has expired. Please select new tickets.</span>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <h1 style={{ fontSize: '2rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Ticket size={28} style={{ color: 'var(--accent)' }} /> Checkout
          </h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
            Complete payment to confirm your booking. Your reservation will expire in 10 minutes.
          </p>

          {booking && (
            <div className="checkout-summary">
              <div className="summary-row">
                <span>Booking ID</span>
                <strong style={{ color: 'var(--text-strong)' }}>{booking.id}</strong>
              </div>
              <div className="summary-row">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={16} />
                  Remaining Time
                </span>
                <strong style={{ color: isExpired ? 'var(--danger)' : 'var(--accent)', fontSize: '1.25rem' }}>
                  {formatTimeLeft(timeLeft)}
                </strong>
              </div>
              <div className="summary-row summary-total">
                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-strong)' }}>Amount Due</span>
                <strong>{booking.totalAmount.toLocaleString()} VND</strong>
              </div>
            </div>
          )}

          <div className="payment-options">
            <button
              onClick={() => handlePayment('momo')}
              disabled={submitting || cbStatus.momo === 'OPEN' || isExpired}
              className="btn btn-primary payment-momo"
              style={{
                backgroundColor: (cbStatus.momo === 'OPEN' || isExpired) ? 'var(--border)' : '#A50064',
                minHeight: 56,
                cursor: isExpired ? 'not-allowed' : 'pointer'
              }}
            >
              <CreditCard size={18} />
              Pay with MoMo {cbStatus.momo === 'OPEN' ? '(Maintenance)' : ''}
            </button>

            <button
              onClick={() => handlePayment('vnpay')}
              disabled={submitting || cbStatus.vnpay === 'OPEN' || isExpired}
              className="btn btn-primary payment-vnpay"
              style={{
                backgroundColor: (cbStatus.vnpay === 'OPEN' || isExpired) ? 'var(--border)' : '#005BAA',
                minHeight: 56,
                cursor: isExpired ? 'not-allowed' : 'pointer'
              }}
            >
              <CreditCard size={18} />
              Pay with VNPAY {cbStatus.vnpay === 'OPEN' ? '(Maintenance)' : ''}
            </button>
          </div>

          {allGatewaysOffline && (
            <div className="alert alert-warning" style={{ marginTop: '2rem', textAlign: 'center', marginBottom: 0, borderLeft: '4px solid var(--warning)' }}>
              <strong>Cổng thanh toán trực tuyến bảo trì / Payment Gateways Offline</strong>
              <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                Hệ thống thanh toán trực tuyến hiện đang bảo trì. Vé của bạn đã được giữ tạm thời. Vui lòng liên hệ bộ phận CSKH hoặc Ban tổ chức để hoàn tất thanh toán thủ công hoặc thử lại sau.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
