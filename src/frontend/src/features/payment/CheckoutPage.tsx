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
  createdAt?: string;
  expiresAt?: string;
  status: string;
}

const HOLD_DURATION_MS = 10 * 60 * 1000;

const parseDateMs = (value?: string) => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const getHoldExpiryMs = (booking: BookingData) => {
  const explicitExpiryMs = parseDateMs(booking.expiresAt);
  if (explicitExpiryMs !== null) return explicitExpiryMs;

  const createdAtMs = parseDateMs(booking.createdAt);
  if (createdAtMs !== null) return createdAtMs + HOLD_DURATION_MS;

  return null;
};

const normalizeErrorMessage = (message: string) =>
  message
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Ä‘/g, 'd');

const extractErrorMessage = (err: unknown) => {
  if (err instanceof Error) return err.message;

  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }

  return '';
};

const getPaymentInitErrorMessage = (gateway: 'momo' | 'vnpay', err: unknown) => {
  const rawMessage = extractErrorMessage(err);
  const normalized = normalizeErrorMessage(rawMessage);
  const gatewayName = gateway === 'momo' ? 'MoMo' : 'VNPAY';
  const alternateGateway = gateway === 'momo' ? 'VNPAY' : 'MoMo';

  if (
    normalized.includes('payment failed') ||
    normalized.includes('service unavailable') ||
    normalized.includes('circuit') ||
    normalized.includes('don hang da bi huy') ||
    normalized.includes('order has been cancelled') ||
    normalized.includes('cancelled')
  ) {
    return `${gatewayName} chưa thể tạo giao dịch mới cho đơn này. Vui lòng thử ${alternateGateway} hoặc quay lại chọn vé mới.`;
  }

  if (normalized.includes('not in pending') || normalized.includes('expired')) {
    return 'Đơn đặt vé không còn ở trạng thái chờ thanh toán. Vui lòng quay lại chọn vé mới.';
  }

  return rawMessage || `Không thể khởi tạo thanh toán qua ${gatewayName}. Vui lòng thử phương thức khác.`;
};

export const CheckoutPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();

  const [booking, setBooking] = useState<BookingData | null>(null);
  const [cbStatus, setCbStatus] = useState<CircuitBreakerStatus>({ momo: 'CLOSED', vnpay: 'CLOSED' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [holdExpiresAtMs, setHoldExpiresAtMs] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const loadCheckoutData = async () => {
      try {
        const [bookingRes, cbRes] = await Promise.all([
          apiClient.request<BookingData>(`/bookings/${orderId}`),
          apiClient
            .request<CircuitBreakerStatus>('/payments/circuit-breaker/status')
            .catch((): CircuitBreakerStatus => ({ momo: 'CLOSED', vnpay: 'CLOSED' })),
        ]);

        setBooking(bookingRes);
        setCbStatus(cbRes);

        if (bookingRes.status === 'expired' || bookingRes.status === 'cancelled') {
          setIsExpired(true);
          setTimeLeft(0);
          setHoldExpiresAtMs(null);
          return;
        }

        const expiresTime = getHoldExpiryMs(bookingRes);
        if (expiresTime === null) {
          setIsExpired(true);
          setTimeLeft(0);
          setHoldExpiresAtMs(null);
          setError('Không xác định được thời gian giữ vé. Vui lòng quay lại chọn vé mới.');
          return;
        }

        const secondsRemaining = Math.max(0, Math.floor((expiresTime - Date.now()) / 1000));
        setHoldExpiresAtMs(expiresTime);
        setTimeLeft(secondsRemaining);
        if (secondsRemaining <= 0) {
          setIsExpired(true);
          return;
        }

        setIsExpired(false);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Không tải được thông tin thanh toán.';
        setError(errMsg);
      } finally {
        setLoading(false);
      }
    };

    loadCheckoutData();
  }, [orderId]);

  useEffect(() => {
    if (holdExpiresAtMs === null || isExpired || !booking) return;

    const updateRemainingTime = () => {
      const secondsRemaining = Math.max(0, Math.floor((holdExpiresAtMs - Date.now()) / 1000));
      setTimeLeft(secondsRemaining);

      if (secondsRemaining <= 0) {
        setIsExpired(true);
      }
    };

    updateRemainingTime();
    const interval = setInterval(updateRemainingTime, 1000);

    return () => clearInterval(interval);
  }, [booking, holdExpiresAtMs, isExpired]);

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
          orderId,
          orderInfo: `Thanh toán đơn TicketBox ${orderId}`,
        }),
      });

      if (response.payUrl) {
        window.location.href = response.payUrl;
      } else {
        throw new Error('Cổng thanh toán chưa trả về liên kết thanh toán.');
      }
    } catch (err: unknown) {
      setError(getPaymentInitErrorMessage(gateway, err));
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
          <span>Thời gian giữ vé đã hết hạn. Vui lòng quay lại chọn vé mới.</span>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <h1 style={{ fontSize: '2rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Ticket size={28} style={{ color: 'var(--accent)' }} /> Thanh toán
          </h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
            Hoàn tất thanh toán để xác nhận vé. Thời gian giữ vé tối đa là 10 phút.
          </p>

          {booking && (
            <div className="checkout-summary">
              <div className="summary-row">
                <span>Mã đặt vé</span>
                <strong style={{ color: 'var(--text-strong)' }}>{booking.id}</strong>
              </div>
              <div className="summary-row">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={16} />
                  Thời gian còn lại
                </span>
                <strong style={{ color: isExpired ? 'var(--danger)' : 'var(--accent)', fontSize: '1.25rem' }}>
                  {formatTimeLeft(timeLeft)}
                </strong>
              </div>
              <div className="summary-row summary-total">
                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-strong)' }}>Số tiền cần thanh toán</span>
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
                cursor: isExpired ? 'not-allowed' : 'pointer',
              }}
            >
              <CreditCard size={18} />
              Thanh toán bằng MoMo {cbStatus.momo === 'OPEN' ? '(Bảo trì)' : ''}
            </button>

            <button
              onClick={() => handlePayment('vnpay')}
              disabled={submitting || cbStatus.vnpay === 'OPEN' || isExpired}
              className="btn btn-primary payment-vnpay"
              style={{
                backgroundColor: (cbStatus.vnpay === 'OPEN' || isExpired) ? 'var(--border)' : '#005BAA',
                minHeight: 56,
                cursor: isExpired ? 'not-allowed' : 'pointer',
              }}
            >
              <CreditCard size={18} />
              Thanh toán bằng VNPAY {cbStatus.vnpay === 'OPEN' ? '(Bảo trì)' : ''}
            </button>
          </div>

          {allGatewaysOffline && (
            <div className="alert alert-warning" style={{ marginTop: '2rem', textAlign: 'center', marginBottom: 0, borderLeft: '4px solid var(--warning)' }}>
              <strong>Cổng thanh toán trực tuyến đang bảo trì</strong>
              <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                Hệ thống thanh toán trực tuyến hiện đang bảo trì. Vé của bạn đang được giữ tạm thời. Vui lòng liên hệ bộ phận hỗ trợ hoặc Ban tổ chức để hoàn tất thanh toán thủ công, hoặc thử lại sau.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
