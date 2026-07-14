import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import * as QRCode from 'qrcode';
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

interface PaymentStatusDetails {
  orderId: string;
  orderStatus: string;
  payments: Array<{
    id: string;
    gateway: string;
    status: string;
    transactionId: string | null;
    amount: number;
    payUrl?: string | null;
    createdAt: string;
  }>;
}

type CallbackOutcome =
  | { gateway: 'momo'; resultCode: number | null; message: string; isSuccess: boolean; isCancelled: boolean }
  | { gateway: 'vnpay'; responseCode: string | null; message: string; isSuccess: boolean; isCancelled: boolean }
  | null;

const normalizeCallbackMessage = (message: string) =>
  message
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

const isCancellationMessage = (message: string) => {
  const normalized = normalizeCallbackMessage(message);
  return (
    normalized.includes('huy') ||
    normalized.includes('cancel') ||
    normalized.includes('tu choi') ||
    normalized.includes('rejected')
  );
};

const TicketQrCode: React.FC<{ value: string }> = ({ value }) => {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrError, setQrError] = useState('');

  useEffect(() => {
    let active = true;

    setQrDataUrl('');
    setQrError('');

    QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 200,
    })
      .then((dataUrl) => {
        if (active) {
          setQrDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (active) {
          setQrError('QR Code is unavailable.');
        }
      });

    return () => {
      active = false;
    };
  }, [value]);

  if (qrError) {
    return (
      <div style={{ padding: '2rem', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
        {qrError}
      </div>
    );
  }

  if (!qrDataUrl) {
    return (
      <div style={{ padding: '2rem', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
        QR Code is generating...
      </div>
    );
  }

  return (
    <img
      src={qrDataUrl}
      alt="QR Code"
      aria-label="QR Code"
      width="200"
      height="200"
      style={{ display: 'block' }}
    />
  );
};

export const PaymentCallback: React.FC = () => {
  const { orderId: pathOrderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const orderId = pathOrderId || searchParams.get('orderId') || searchParams.get('vnp_TxnRef') || '';
  
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusDetails | null>(null);
  const [status, setStatus] = useState<'processing' | 'success' | 'failed' | 'cancelled' | 'timeout'>('processing');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [callbackMessage, setCallbackMessage] = useState('');
  
  const [retryTrigger, setRetryTrigger] = useState(0);
  const forwardedGatewayCallbackRef = useRef(false);

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
          const paymentResponse = await apiClient.request<PaymentStatusDetails>(`/payments/${orderId}`);
          if (!active) return true;
          setPaymentStatus(paymentResponse);
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

    const getMomoCallbackOutcome = (): CallbackOutcome => {
      const routerSearch = location.search && location.search !== '?' ? location.search : '';
      const search = (routerSearch || window.location.search).replace(/^\?/, '');
      if (!search) return null;

      const params = new URLSearchParams(search);
      const partnerCode = params.get('partnerCode');
      const momoOrderId = params.get('orderId');
      const resultCodeRaw = params.get('resultCode');
      const message = params.get('message') || '';

      if (partnerCode !== 'MOMO' || momoOrderId !== orderId) {
        return null;
      }

      const resultCode = resultCodeRaw === null ? null : Number(resultCodeRaw);
      if (resultCodeRaw !== null && Number.isNaN(resultCode)) return null;

      const messageLooksCancelled = isCancellationMessage(message);

      return {
        gateway: 'momo',
        resultCode,
        message,
        isSuccess: resultCode === 0,
        isCancelled: resultCode === 1002 || messageLooksCancelled,
      };
    };

    const getVnpayCallbackOutcome = (): CallbackOutcome => {
      const routerSearch = location.search && location.search !== '?' ? location.search : '';
      const search = (routerSearch || window.location.search).replace(/^\?/, '');
      if (!search) return null;

      const params = new URLSearchParams(search);
      const vnpTxnRef = params.get('vnp_TxnRef');
      const vnpResponseCode = params.get('vnp_ResponseCode');
      const vnpSecureHash = params.get('vnp_SecureHash');

      if (!vnpTxnRef || !vnpResponseCode || !vnpSecureHash) {
        return null;
      }

      if (orderId && !vnpTxnRef.includes(orderId)) {
        return null;
      }

      const isSuccess = vnpResponseCode === '00';
      const isCancelled = vnpResponseCode === '24';
      
      let message = 'Giao dịch VNPAY thất bại';
      if (isSuccess) {
        message = 'Thanh toán VNPAY thành công';
      } else if (isCancelled) {
        message = 'Giao dịch VNPAY đã bị hủy bởi người dùng';
      }

      return {
        gateway: 'vnpay',
        responseCode: vnpResponseCode,
        message,
        isSuccess,
        isCancelled,
      };
    };

    const forwardGatewayCallback = async () => {
      if (forwardedGatewayCallbackRef.current) return null;

      const routerSearch = location.search && location.search !== '?' ? location.search : '';
      const search = (routerSearch || window.location.search).replace(/^\?/, '');
      if (!search) return null;

      const params = new URLSearchParams(search);
      const partnerCode = params.get('partnerCode');
      const momoOrderId = params.get('orderId');
      const momoSignature = params.get('signature');

      if (partnerCode === 'MOMO' && momoOrderId === orderId && momoSignature) {
        forwardedGatewayCallbackRef.current = true;
        await apiClient.request(`/payments/momo/webhook?${search}`, {
          method: 'POST',
        });
        return getMomoCallbackOutcome();
      }

      const vnpTxnRef = params.get('vnp_TxnRef');
      const vnpSecureHash = params.get('vnp_SecureHash');

      if (vnpTxnRef && vnpSecureHash && vnpTxnRef.includes(orderId)) {
        forwardedGatewayCallbackRef.current = true;
        await apiClient.request(`/payments/vnpay/webhook?${search}`, {
          method: 'POST',
        });
        return getVnpayCallbackOutcome();
      }

      return null;
    };

    const runPoll = async () => {
      const gatewayOutcome = await forwardGatewayCallback();
      if (!active) return;

      if (gatewayOutcome && !gatewayOutcome.isSuccess) {
        setCallbackMessage(gatewayOutcome.message);
        setStatus(gatewayOutcome.isCancelled ? 'cancelled' : 'failed');
        setLoading(false);
        return;
      }

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
  }, [location.search, orderId, retryTrigger]);

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
            Quay lại Trang chủ
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
                Thanh toán thành công!
              </h1>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
                Vé của bạn đã được xác nhận và kích hoạt. Hãy xuất trình mã QR bên dưới khi check-in tại sự kiện.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
                {booking.tickets && booking.tickets.map((t) => {
                  const qrHash = t.qrCodeHash;
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
                        VÉ ĐIỆN TỬ
                      </strong>
                      <span style={{ display: 'block', color: 'var(--primary)', fontWeight: 800, marginBottom: '1.5rem', textTransform: 'uppercase' }}>
                        Hạng vé: {t.ticketType?.name || 'Thường (GA)'}
                      </span>
                      
                      {qrHash ? (
                        <div style={{ background: '#fff', padding: '1rem', borderRadius: 'var(--radius-sm)', display: 'inline-block', margin: '0 auto' }}>
                          <TicketQrCode value={qrHash} />
                        </div>
                      ) : (
                        <div style={{ padding: '2rem', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                          Đang tạo mã QR...
                        </div>
                      )}
                      
                      <div style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span><strong>Mã vé:</strong> {t.id}</span>
                        <span><strong>Trạng thái:</strong> {t.status === 'valid' ? 'Hợp lệ' : t.status === 'refunded' ? 'Đã hoàn tiền' : t.status}</span>
                        <span><strong>Soát vé:</strong> {t.checkinStatus === 'checked_in' ? 'Đã soát' : 'Chưa soát'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {paymentStatus?.payments.length ? (
                <section className="soft-panel" aria-label="Trạng thái thanh toán" style={{ marginTop: '2rem', textAlign: 'left' }}>
                  <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Trạng thái thanh toán</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {paymentStatus.payments.map((payment) => (
                      <div key={payment.id} className="summary-row" style={{ gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <span>{payment.gateway === 'momo' ? 'Ví MoMo' : payment.gateway === 'vnpay' ? 'Cổng VNPAY' : payment.gateway}</span>
                        <strong style={{ color: 'var(--text-strong)' }}>{payment.status === 'success' ? 'Thành công' : payment.status === 'failed' ? 'Thất bại' : payment.status}</strong>
                        {payment.transactionId && <span>Mã giao dịch: {payment.transactionId}</span>}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          )}

          {status === 'failed' && (
            <div>
              <div className="flex-center" style={{ marginBottom: '1.5rem' }}>
                <XCircle size={64} style={{ color: 'var(--danger)' }} />
              </div>
              <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'var(--danger)' }}>
                Thanh toán thất bại
              </h1>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
                {callbackMessage || 'Giao dịch chưa hoàn tất. Nếu tài khoản của bạn đã bị trừ tiền, vui lòng liên hệ Ban tổ chức để được hỗ trợ đối soát.'}
              </p>
            </div>
          )}

          {status === 'cancelled' && (
            <div>
              <div className="flex-center" style={{ marginBottom: '1.5rem' }}>
                <XCircle size={64} style={{ color: 'var(--warning)' }} />
              </div>
              <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'var(--warning)' }}>
                Thanh toán đã bị hủy
              </h1>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
                {callbackMessage || 'Bạn đã hủy hoặc từ chối giao dịch. Vé vẫn có thể được giữ trong thời gian còn hiệu lực để bạn thử thanh toán lại.'}
              </p>
            </div>
          )}

          {status === 'timeout' && (
            <div>
              <div className="flex-center" style={{ marginBottom: '1.5rem', color: 'var(--warning)' }}>
                <Clock size={64} />
              </div>
              <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'var(--warning)' }}>
                Giao dịch đang chờ xác nhận
              </h1>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
                Hệ thống chưa nhận được phản hồi xác nhận từ cổng thanh toán. Trạng thái giao dịch sẽ được cập nhật tự động. Vui lòng kiểm tra email của bạn sau ít phút hoặc xem lịch sử đơn hàng.
              </p>
            </div>
          )}

          <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              onClick={() => navigate('/')}
              className="btn btn-outline"
              style={{ minWidth: 150, gap: '0.5rem' }}
            >
              <ArrowLeft size={16} /> Về trang chủ
            </button>
            
            {(status === 'timeout' || status === 'failed' || status === 'cancelled') && orderId && (
              <button
                onClick={() => navigate('/checkout/' + orderId)}
                className="btn btn-primary"
                style={{ minWidth: 150, gap: '0.5rem' }}
              >
                Thanh toán lại
              </button>
            )}

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
                <RefreshCw size={16} /> Thử lại
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
