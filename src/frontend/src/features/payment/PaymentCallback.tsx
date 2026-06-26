import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { CheckCircle, XCircle } from 'lucide-react';

interface TicketData {
  id: string;
  ticket_type_id: string;
  qr_code_hash: string;
  checkin_status: string;
}

interface BookingDetails {
  id: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  total_amount: number;
  tickets?: TicketData[];
}

export const PaymentCallback: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const getBookingResult = async () => {
      try {
        const response = await apiClient.request<BookingDetails>(`/bookings/${orderId}`);
        setBooking(response);
      } catch (err: any) {
        setError(err.message || 'Failed to load booking status');
      } finally {
        setLoading(false);
      }
    };

    getBookingResult();
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex-center" style={{ padding: 64, minHeight: '50dvh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-narrow">
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  const isSuccess = booking?.status === 'paid';

  return (
    <div className="container-narrow">
      <div className="card state-card">
        <div className="card-body" style={{ padding: '3rem 2rem' }}>
          {isSuccess ? (
            <div>
              <div className="flex-center" style={{ marginBottom: '1.5rem' }}>
                <CheckCircle size={64} style={{ color: 'var(--success)' }} />
              </div>
              <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
                Payment Successful!
              </h1>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem' }}>
                Your tickets are locked and secured. Present the QR code below at the event gates.
              </p>

              {booking?.tickets && booking.tickets.map((t) => (
                <div
                  key={t.id}
                  style={{
                    border: '2px dashed var(--border)',
                    padding: '2rem',
                    borderRadius: 'var(--radius)',
                    display: 'inline-block',
                    backgroundColor: 'var(--surface-alt)',
                    marginBottom: '1.5rem',
                    width: '100%',
                    maxWidth: '300px',
                  }}
                >
                  <strong style={{ display: 'block', fontSize: '1.2rem', color: 'var(--text-strong)', marginBottom: '1rem' }}>
                    E-Ticket
                  </strong>
                  
                  {/* SVG mock QR representation */}
                  <svg width="150" height="150" style={{ backgroundColor: '#fff', padding: '0.5rem', borderRadius: 'var(--radius-sm)', margin: '0 auto' }} aria-label="QR Code">
                    <rect x="10" y="10" width="30" height="30" fill="#000" />
                    <rect x="110" y="10" width="30" height="30" fill="#000" />
                    <rect x="10" y="110" width="30" height="30" fill="#000" />
                    <rect x="50" y="50" width="50" height="50" fill="#000" />
                  </svg>
                  
                  <code style={{ display: 'block', marginTop: '1rem', color: 'var(--text-muted)' }}>
                    ID: {t.id}
                  </code>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <div className="flex-center" style={{ marginBottom: '1.5rem' }}>
                <XCircle size={64} style={{ color: 'var(--danger)' }} />
              </div>
              <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
                Payment Failed or Pending
              </h1>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem' }}>
                We could not confirm your payment. If you have been charged, please contact the organizers.
              </p>
            </div>
          )}

          <div style={{ marginTop: '1.5rem' }}>
            <button
              onClick={() => navigate('/')}
              className="btn btn-primary"
              style={{ minWidth: 180 }}
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
