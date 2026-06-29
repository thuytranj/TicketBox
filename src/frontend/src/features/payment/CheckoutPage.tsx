import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { Clock, CreditCard, Ticket } from 'lucide-react';

interface CircuitBreakerStatus {
  momo: 'CLOSED' | 'OPEN' | 'HALF-OPEN';
  vnpay: 'CLOSED' | 'OPEN' | 'HALF-OPEN';
}

interface BookingData {
  id: string;
  total_amount: number;
  expires_at: string;
  status: string;
}

export const CheckoutPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [cbStatus, setCbStatus] = useState<CircuitBreakerStatus>({ momo: 'CLOSED', vnpay: 'CLOSED' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadCheckoutData = async () => {
      try {
        const [bookingRes, cbRes] = await Promise.all([
          apiClient.request<BookingData>(`/bookings/${orderId}`),
          apiClient.request<CircuitBreakerStatus>('/payments/circuit-breaker/status').catch((): CircuitBreakerStatus => ({ momo: 'CLOSED', vnpay: 'CLOSED' })),
        ]);

        setBooking(bookingRes);
        setCbStatus(cbRes);
      } catch (err: any) {
        setError(err.message || 'Failed to load checkout details');
      } finally {
        setLoading(false);
      }
    };

    loadCheckoutData();
  }, [orderId]);

  const handlePayment = async (gateway: 'momo' | 'vnpay') => {
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
    } catch (err: any) {
      setError(err.message || 'Payment initiation failed. Please try another method.');
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

  return (
    <div className="container-narrow">
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
          {error}
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
                  Expiry time
                </span>
                <strong style={{ color: 'var(--danger)' }}>
                  {new Date(booking.expires_at).toLocaleTimeString()}
                </strong>
              </div>
              <div className="summary-row summary-total">
                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-strong)' }}>Amount Due</span>
                <strong>{booking.total_amount.toLocaleString()} VND</strong>
              </div>
            </div>
          )}

          <div className="payment-options">
            <button
              onClick={() => handlePayment('momo')}
              disabled={submitting || cbStatus.momo === 'OPEN'}
              className="btn btn-primary payment-momo"
              style={{
                backgroundColor: cbStatus.momo === 'OPEN' ? 'var(--border)' : '#A50064',
                minHeight: 56,
              }}
            >
              <CreditCard size={18} />
              Pay with MoMo {cbStatus.momo === 'OPEN' && '(Maintenance)'}
            </button>

            <button
              onClick={() => handlePayment('vnpay')}
              disabled={submitting || cbStatus.vnpay === 'OPEN'}
              className="btn btn-primary payment-vnpay"
              style={{
                backgroundColor: cbStatus.vnpay === 'OPEN' ? 'var(--border)' : '#005BAA',
                minHeight: 56,
              }}
            >
              <CreditCard size={18} />
              Pay with VNPAY {cbStatus.vnpay === 'OPEN' && '(Maintenance)'}
            </button>
          </div>

          {allGatewaysOffline && (
            <div className="alert alert-danger" style={{ marginTop: '2rem', textAlign: 'center', marginBottom: 0 }}>
              <strong>All payment gateways are currently offline.</strong> Please try again later. Pay Later is not supported.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
