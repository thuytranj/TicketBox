import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';

interface BookingData {
  id: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  total_amount: number;
  expires_at: string;
}

export const BookingProcess: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'pending' | 'expired' | 'failed'>('processing');
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [error, setError] = useState('');
  const pollIntervalRef = useRef<any>(null);

  const pollStatus = async () => {
    try {
      const response = await apiClient.request<BookingData>(`/bookings/${orderId}`);
      setBooking(response);

      if (response.status === 'pending') {
        setStatus('pending');
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        navigate(`/checkout/${orderId}`);
      } else if (response.status === 'expired' || response.status === 'cancelled') {
        setStatus('expired');
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      }
    } catch (err: any) {
      setError(err.message || 'Error checking booking status');
      setStatus('failed');
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    }
  };

  useEffect(() => {
    pollStatus();
    pollIntervalRef.current = setInterval(pollStatus, 2000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [orderId]);

  return (
    <div className="card state-card">
      <div className="card-body">
        <h2 style={{ color: 'var(--text-strong)', marginBottom: 12 }}>Processing Your Booking</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
          We are holding your selected tickets before checkout opens.
        </p>
        
        {status === 'processing' && (
          <div style={{ padding: '16px 0' }}>
            <div className="flex-center" style={{ marginBottom: 20 }}>
              <div className="spinner" />
            </div>
            <p style={{ color: 'var(--text-muted)' }}>Holding your tickets. Please wait a moment...</p>
          </div>
        )}

        {status === 'expired' && (
          <div style={{ padding: '8px 0' }}>
            <p style={{ color: 'var(--danger)', fontWeight: 600, fontSize: '1.2rem', marginBottom: '1.5rem' }}>Booking Expired or Cancelled</p>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>We were unable to secure your seats in time or the booking has expired.</p>
            <button onClick={() => navigate('/')} className="btn btn-primary" style={{ minWidth: '180px' }}>
              Return to Events
            </button>
          </div>
        )}

        {status === 'failed' && (
          <div style={{ padding: '8px 0' }}>
            <p style={{ color: 'var(--danger)', fontWeight: 600, fontSize: '1.2rem', marginBottom: '1.5rem' }}>Failed to Secure Tickets</p>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>{error}</p>
            <button onClick={() => navigate('/')} className="btn btn-primary" style={{ minWidth: '180px' }}>
              Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
