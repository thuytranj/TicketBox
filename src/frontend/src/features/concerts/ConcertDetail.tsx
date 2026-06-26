import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { CalendarDays, MapPin, Minus, Plus, Ticket } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

interface TicketType {
  id: string;
  name: 'GA' | 'SVIP' | 'VIP' | 'CAT1' | 'CAT2';
  price: number;
  total_quantity: number;
  available_quantity: number;
  max_per_user: number;
}

interface ConcertDetailData {
  id: string;
  title: string;
  description: string;
  artistSummary?: string;
  biography?: string;
  location: string;
  posterUrl: string;
  start_time: string;
}

export const ConcertDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [concert, setConcert] = useState<ConcertDetailData | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [svgMap, setSvgMap] = useState('');
  const [selectedTicketType, setSelectedTicketType] = useState<TicketType | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [bookingSubmit, setBookingSubmit] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDetails = async () => {
      try {
        const [concertRes, ticketsRes, svgRes] = await Promise.all([
          apiClient.request<{ data: ConcertDetailData }>(`/concerts/${id}`),
          apiClient.request<{ data: TicketType[] }>(`/concerts/${id}/ticket-types`),
          apiClient.request<{ svgStageMap?: string }>(`/concerts/${id}/stagemap`).catch(() => ({ svgStageMap: '' })),
        ]);

        setConcert(concertRes.data);
        setTicketTypes(ticketsRes.data);
        setSvgMap(svgRes.svgStageMap || '');
      } catch (err: any) {
        setError(err.message || 'Failed to load details');
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [id]);

  const handleZoneClick = (zoneName: string) => {
    const matchingType = ticketTypes.find((t) => t.name.toLowerCase() === zoneName.toLowerCase());
    if (matchingType) {
      setSelectedTicketType(matchingType);
      setQuantity(1);
    }
  };

  const handleBook = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!selectedTicketType) return;

    setBookingSubmit(true);
    setError('');
    try {
      const idempotencyKey = crypto.randomUUID();
      const response = await apiClient.request<{ orderId: string }>('/bookings', {
        method: 'POST',
        headers: {
          'idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          concertId: id,
          items: [
            {
              ticketTypeId: selectedTicketType.id,
              quantity,
            },
          ],
        }),
      });

      navigate(`/bookings/processing/${response.orderId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create booking');
      setBookingSubmit(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-center" style={{ padding: 64, minHeight: '50dvh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!concert) {
    return (
      <div className="flex-center" style={{ padding: 64, minHeight: '50dvh' }}>
        <p style={{ color: 'var(--text-muted)' }}>Concert not found.</p>
      </div>
    );
  }

  return (
    <div className="container">
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="split-layout">
        <div>
          <section className="detail-hero">
            <img
              src={concert.posterUrl || `https://picsum.photos/seed/${encodeURIComponent(concert.title)}/1000/640`}
              alt={concert.title}
            />
            <div className="detail-hero-content">
              <div className="eyebrow">Live event</div>
              <h1>{concert.title}</h1>
              <div className="meta-list">
                <div className="meta-item">
                  <MapPin size={20} />
                  <span>{concert.location}</span>
                </div>
                <div className="meta-item">
                  <CalendarDays size={20} />
                  <span>{new Date(concert.start_time).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="content-section soft-panel">
            <h2>Description</h2>
            <p>{concert.description}</p>
          </section>

          {(concert.biography || concert.artistSummary) && (
            <section className="content-section soft-panel">
              <h2>Artist Biography</h2>
              <p>{concert.biography || concert.artistSummary}</p>
            </section>
          )}

          {svgMap && (
            <section className="content-section">
              <h2>Interactive Stage Map</h2>
              <div
                className="stage-map"
                dangerouslySetInnerHTML={{ __html: svgMap }}
                onClick={(e) => {
                  const target = e.target as SVGElement;
                  const zoneId = target.getAttribute('id') || target.parentElement?.getAttribute('id');
                  if (zoneId) {
                    handleZoneClick(zoneId);
                  }
                }}
              />
            </section>
          )}
        </div>

        <aside className="aside-sticky">
          <h2 className="aside-title">
            <Ticket size={20} style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--accent)' }} />
            Select Ticket Type
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {ticketTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => {
                  setSelectedTicketType(type);
                  setQuantity(1);
                }}
                className={`ticket-type-option ${selectedTicketType?.id === type.id ? 'selected' : ''}`}
              >
                <div>
                  <strong style={{ display: 'block', color: 'var(--text-strong)' }}>{type.name}</strong>
                  <span style={{ fontSize: '0.85rem', color: type.available_quantity > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                    {type.available_quantity} available
                  </span>
                </div>
                <span style={{ fontWeight: 800 }}>{type.price.toLocaleString()} VND</span>
              </button>
            ))}
          </div>

          {selectedTicketType && (
            <div>
              <div className="summary-row" style={{ alignItems: 'center', marginBottom: 20 }}>
                <span style={{ color: 'var(--text)' }}>Quantity</span>
                <div className="quantity-control">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="btn btn-outline"
                    aria-label="Decrease quantity"
                  >
                    <Minus size={16} />
                  </button>
                  <span style={{ width: 24, textAlign: 'center', fontWeight: 800 }}>{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(selectedTicketType.max_per_user, selectedTicketType.available_quantity, q + 1))}
                    className="btn btn-outline"
                    aria-label="Increase quantity"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="summary-total" style={{ marginBottom: 22 }}>
                <div className="summary-row">
                  <span>Ticket tier</span>
                  <strong style={{ color: 'var(--text-strong)' }}>{selectedTicketType.name}</strong>
                </div>
                <div className="summary-row">
                  <span>Total Amount</span>
                  <strong>{(selectedTicketType.price * quantity).toLocaleString()} VND</strong>
                </div>
              </div>

              <button
                onClick={handleBook}
                disabled={bookingSubmit || selectedTicketType.available_quantity === 0}
                className="btn btn-primary"
                style={{ width: '100%', minHeight: 52 }}
              >
                {bookingSubmit ? 'Processing Booking...' : 'Book Tickets'}
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
