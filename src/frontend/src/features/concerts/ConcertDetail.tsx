import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { CalendarDays, MapPin, Minus, Plus, Ticket } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import heroPreview from '../../assets/hero.png';

const INVENTORY_REFRESH_MS = 10000;

interface TicketType {
  id: string;
  name: 'GA' | 'SVIP' | 'VIP' | 'CAT1' | 'CAT2';
  price: number;
  totalQuantity: number;
  availableQuantity: number;
  maxPerUser: number;
}

interface ConcertDetailData {
  id: string;
  title: string;
  description: string;
  artistSummary?: string;
  biography?: string;
  location: string;
  posterUrl: string;
  startTime: string;
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
  const [bookingError, setBookingError] = useState('');

  const refreshTicketTypes = async () => {
    if (!id) return;
    const ticketsRes = await apiClient.request<TicketType[]>(`/concerts/${id}/ticket-types`);
    setTicketTypes(ticketsRes);
  };

  useEffect(() => {
    const loadDetails = async () => {
      try {
        const [concertRes, ticketsRes, svgRes] = await Promise.all([
          apiClient.request<ConcertDetailData>(`/concerts/${id}`),
          apiClient.request<TicketType[]>(`/concerts/${id}/ticket-types`),
          apiClient.request<{ svgStageMap?: string }>(`/concerts/${id}/stagemap`).catch(() => ({ svgStageMap: '' })),
        ]);

        setConcert(concertRes);
        setTicketTypes(ticketsRes);
        setSvgMap(svgRes.svgStageMap || '');
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Không tải được thông tin sự kiện';
        setError(errMsg);
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const refreshInventory = () =>
      refreshTicketTypes().catch(() => {
        // Keep the last known inventory visible if a transient refresh fails.
      });

    const interval = window.setInterval(refreshInventory, INVENTORY_REFRESH_MS);

    return () => window.clearInterval(interval);
  }, [id]);

  const handleZoneClick = (zoneName: string) => {
    const normalizedZoneName = zoneName.toLowerCase();
    const matchingType = ticketTypes.find((t) => {
      const ticketName = t.name.toLowerCase();
      return normalizedZoneName === ticketName || normalizedZoneName.startsWith(`${ticketName}-`) || normalizedZoneName.startsWith(`${ticketName}_`);
    });
    if (matchingType && matchingType.availableQuantity > 0) {
      setSelectedTicketType(matchingType);
      setQuantity(1);
    }
  };

  // Effect to polish SVG Map zones with colors, highlighting, and tooltips
  useEffect(() => {
    if (!svgMap || ticketTypes.length === 0) return;

    // Find the container element
    const container = document.querySelector('.stage-map');
    if (!container) return;

    const svgElement = container.querySelector('svg');
    if (!svgElement) return;

    // Find clickable elements (paths, polygons, rects, circles, groups with IDs)
    const elements = svgElement.querySelectorAll('path, polygon, rect, circle, g');
    elements.forEach((el) => {
      const id = el.getAttribute('id');
      if (!id) return;

      const matchingType = ticketTypes.find((t) => t.name.toLowerCase() === id.toLowerCase());
      if (!matchingType) return;

      // Reset classes
      el.classList.remove('zone-available', 'zone-selected', 'zone-soldout', 'zone-svip', 'zone-vip', 'zone-ga', 'zone-cat');

      // Determine category branding class
      const nameLower = matchingType.name.toLowerCase();
      if (nameLower === 'svip') {
        el.classList.add('zone-svip');
      } else if (nameLower === 'vip') {
        el.classList.add('zone-vip');
      } else if (nameLower === 'ga') {
        el.classList.add('zone-ga');
      } else {
        el.classList.add('zone-cat');
      }

      // Add status class and tooltips
      if (matchingType.availableQuantity === 0) {
        el.classList.add('zone-soldout');
        el.setAttribute('title', `${matchingType.name} (Hết vé / Sold Out)`);
      } else if (selectedTicketType?.id === matchingType.id) {
        el.classList.add('zone-selected');
        el.setAttribute('title', `${matchingType.name} (Đang chọn - Còn ${matchingType.availableQuantity} vé)`);
      } else {
        el.classList.add('zone-available');
        el.setAttribute('title', `${matchingType.name} (Còn ${matchingType.availableQuantity} vé - Giá: ${matchingType.price.toLocaleString()} VND)`);
      }
    });
  }, [svgMap, ticketTypes, selectedTicketType]);

  const handleBook = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!selectedTicketType) return;

    setBookingSubmit(true);
    setBookingError('');
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
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Không thể tạo đơn đặt vé';
      setBookingError(errMsg);
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
        <p style={{ color: 'var(--text-muted)' }}>Không tìm thấy sự kiện.</p>
      </div>
    );
  }

  return (
    <div className="container">
      <style>{`
        .stage-map svg path,
        .stage-map svg polygon,
        .stage-map svg rect,
        .stage-map svg circle {
          transition: all 0.25s ease-in-out;
        }
        .zone-available {
          cursor: pointer;
          fill-opacity: 0.35;
        }
        .zone-available:hover {
          fill-opacity: 0.65;
        }
        .zone-svip {
          fill: #eab308;
          stroke: #eab308;
        }
        .zone-vip {
          fill: #a855f7;
          stroke: #a855f7;
        }
        .zone-ga {
          fill: #10b981;
          stroke: #10b981;
        }
        .zone-cat {
          fill: #3b82f6;
          stroke: #3b82f6;
        }
        .zone-selected {
          fill-opacity: 0.85 !important;
          stroke: #ef4444 !important;
          stroke-width: 4px !important;
          filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.8));
          cursor: pointer;
        }
        .zone-soldout {
          fill: #64748b !important;
          fill-opacity: 0.15 !important;
          stroke: #94a3b8 !important;
          stroke-width: 1px !important;
          cursor: not-allowed !important;
          pointer-events: none;
        }
      `}</style>
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="split-layout">
        <div>
          <section className="detail-hero">
            <img
              src={concert.posterUrl || heroPreview}
              alt={concert.title}
            />
            <div className="detail-hero-content">
              <div className="eyebrow">Sự kiện trực tiếp</div>
              <h1>{concert.title}</h1>
              <div className="meta-list">
                <div className="meta-item">
                  <MapPin size={20} />
                  <span>{concert.location}</span>
                </div>
                <div className="meta-item">
                  <CalendarDays size={20} />
                  <span>{new Date(concert.startTime).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="content-section soft-panel">
            <h2>Mô tả</h2>
            <p>{concert.description}</p>
          </section>

          {(concert.biography || concert.artistSummary) && (
            <section className="content-section soft-panel">
              <h2>Thông tin nghệ sĩ</h2>
              <p style={{ whiteSpace: 'pre-wrap' }}>{concert.biography || concert.artistSummary}</p>
            </section>
          )}

          {svgMap && (
            <section className="content-section">
              <h2>Sơ đồ sân khấu</h2>
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

        <aside className="aside-sticky" data-testid="booking-panel">
          <h2 className="aside-title">
            <Ticket size={20} style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--accent)' }} />
            Chọn hạng vé
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {ticketTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => {
                  setSelectedTicketType(type);
                  setQuantity(1);
                  setBookingError('');
                }}
                className={`ticket-type-option ${selectedTicketType?.id === type.id ? 'selected' : ''}`}
                disabled={type.availableQuantity === 0}
              >
                <div>
                  <strong style={{ display: 'block', color: 'var(--text-strong)' }}>{type.name}</strong>
                  <span style={{ fontSize: '0.85rem', color: type.availableQuantity > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                    {type.availableQuantity > 0 ? `Còn ${type.availableQuantity} vé` : 'Hết vé / Sold Out'}
                  </span>
                </div>
                <span style={{ fontWeight: 800 }}>{type.price.toLocaleString()} VND</span>
              </button>
            ))}
          </div>

          {selectedTicketType && (
            <div>
              <div className="summary-row" style={{ alignItems: 'center', marginBottom: 20 }}>
                <span style={{ color: 'var(--text)' }}>Số lượng</span>
                <div className="quantity-control">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="btn btn-outline"
                    aria-label="Giảm số lượng"
                  >
                    <Minus size={16} />
                  </button>
                  <span style={{ width: 24, textAlign: 'center', fontWeight: 800 }}>{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(selectedTicketType.maxPerUser, selectedTicketType.availableQuantity, q + 1))}
                    className="btn btn-outline"
                    aria-label="Tăng số lượng"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="summary-total" style={{ marginBottom: 22 }}>
                <div className="summary-row">
                  <span>Hạng vé</span>
                  <strong style={{ color: 'var(--text-strong)' }}>{selectedTicketType.name}</strong>
                </div>
                <div className="summary-row">
                  <span>Tổng tiền</span>
                  <strong>{(selectedTicketType.price * quantity).toLocaleString()} VND</strong>
                </div>
              </div>

              <button
                onClick={handleBook}
                disabled={bookingSubmit || selectedTicketType.availableQuantity === 0}
                className="btn btn-primary"
                style={{ width: '100%', minHeight: 52 }}
              >
                {bookingSubmit ? 'Đang giữ vé...' : 'Đặt vé'}
              </button>
              {bookingError && (
                <div className="alert alert-danger" role="alert" style={{ marginTop: '1rem', marginBottom: 0 }}>
                  {bookingError}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
