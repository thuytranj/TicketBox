import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import type { Concert } from '../concerts/ConcertList';
import { AlertTriangle, ArrowRight, Calendar, Clock3, MapPin, Music, Plus, Ticket, TrendingUp } from 'lucide-react';

interface TicketTypeInventory {
  id: string;
  name: string;
  totalQuantity: number;
  availableQuantity: number;
  price: number;
  maxPerUser: number;
}

interface ConcertInventorySummary {
  concertId: string;
  title: string;
  totalTickets: number;
  availableTickets: number;
  soldTickets: number;
  fillRate: number;
  failed: boolean;
}

export const AdminDashboard: React.FC = () => {
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [inventorySummaries, setInventorySummaries] = useState<ConcertInventorySummary[]>([]);
  const [inventoryFailures, setInventoryFailures] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchConcerts = async () => {
      try {
        const response = await apiClient.request<{ concerts: Concert[] }>('/concerts');
        const loadedConcerts = response.concerts || [];
        setConcerts(loadedConcerts);

        const inventoryResults = await Promise.allSettled(
          loadedConcerts.map(async (concert) => {
            const ticketTypes = await apiClient.request<TicketTypeInventory[]>(`/concerts/${concert.id}/ticket-types`);
            const totalTickets = ticketTypes.reduce((sum, ticketType) => sum + ticketType.totalQuantity, 0);
            const availableTickets = ticketTypes.reduce((sum, ticketType) => sum + ticketType.availableQuantity, 0);
            const soldTickets = Math.max(totalTickets - availableTickets, 0);

            return {
              concertId: concert.id,
              title: concert.title,
              totalTickets,
              availableTickets,
              soldTickets,
              fillRate: totalTickets > 0 ? Math.round((soldTickets / totalTickets) * 100) : 0,
              failed: false,
            };
          })
        );

        const summaries = inventoryResults.map((result, index) => {
          if (result.status === 'fulfilled') {
            return result.value;
          }

          return {
            concertId: loadedConcerts[index].id,
            title: loadedConcerts[index].title,
            totalTickets: 0,
            availableTickets: 0,
            soldTickets: 0,
            fillRate: 0,
            failed: true,
          };
        });

        setInventorySummaries(summaries);
        setInventoryFailures(summaries.filter((summary) => summary.failed).length);
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchConcerts();
  }, []);

  const totalConcerts = concerts.length;
  const activeConcerts = concerts.filter((c) => c.status === 'active').length;
  const draftConcerts = concerts.filter((c) => c.status === 'draft').length;
  const recentConcerts = concerts.slice(0, 5);
  const totalIssuedTickets = inventorySummaries.reduce((sum, summary) => sum + summary.totalTickets, 0);
  const totalSoldTickets = inventorySummaries.reduce((sum, summary) => sum + summary.soldTickets, 0);
  const overallFillRate = totalIssuedTickets > 0 ? Math.round((totalSoldTickets / totalIssuedTickets) * 100) : 0;
  const salesProgress = [...inventorySummaries].sort((a, b) => b.soldTickets - a.soldTickets).slice(0, 5);

  return (
    <div className="container">
      <header className="section-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Theo dõi nhanh tình trạng sự kiện, lượng vé đã bán/giữ và các thao tác quan trọng.</p>
        </div>
      </header>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="flex-center" style={{ padding: '4rem' }}>
          <div className="spinner" />
        </div>
      ) : (
        <>
          <div className="metric-grid">
            <div className="card metric-card">
              <div className="metric-label">
                <span>Tổng sự kiện</span>
                <Music size={20} style={{ color: 'var(--primary)' }} />
              </div>
              <strong className="metric-value">{totalConcerts}</strong>
            </div>

            <div className="card metric-card">
              <div className="metric-label">
                <span>Đang bán</span>
                <Calendar size={20} style={{ color: 'var(--success)' }} />
              </div>
              <strong className="metric-value">{activeConcerts}</strong>
            </div>

            <div className="card metric-card">
              <div className="metric-label">
                <span>Bản nháp</span>
                <Calendar size={20} style={{ color: 'var(--warning)' }} />
              </div>
              <strong className="metric-value">{draftConcerts}</strong>
            </div>

            <div className="card metric-card">
              <div className="metric-label">
                <span>Tổng vé phát hành</span>
                <Ticket size={20} style={{ color: 'var(--primary)' }} />
              </div>
              <strong className="metric-value">{totalIssuedTickets}</strong>
            </div>

            <div className="card metric-card">
              <div className="metric-label">
                <span>Đã bán/giữ</span>
                <Ticket size={20} style={{ color: 'var(--success)' }} />
              </div>
              <strong className="metric-value">{totalSoldTickets}</strong>
            </div>

            <div className="card metric-card">
              <div className="metric-label">
                <span>Tỷ lệ lấp đầy</span>
                <TrendingUp size={20} style={{ color: 'var(--accent)' }} />
              </div>
              <strong className="metric-value">{overallFillRate}%</strong>
            </div>
          </div>

          {inventoryFailures > 0 && (
            <div className="alert alert-warning dashboard-warning">
              <AlertTriangle size={18} />
              <span>Không tải được hạng vé của {inventoryFailures} concert.</span>
            </div>
          )}

          <div className="admin-panel-grid">
            <div className="card">
              <div className="card-body">
                <h3 className="panel-title">Thao tác nhanh</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <Link to="/admin/concerts" className="btn btn-primary" style={{ justifyContent: 'space-between' }}>
                    <span>Tạo concert</span>
                    <Plus size={18} />
                  </Link>
                  <Link to="/admin/concerts" className="btn btn-outline" style={{ justifyContent: 'space-between' }}>
                    <span>Quản lý sự kiện</span>
                    <ArrowRight size={18} />
                  </Link>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <h3 className="panel-title">Sự kiện gần đây</h3>
                {recentConcerts.length === 0 ? (
                  <div className="soft-panel">
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Chưa có sự kiện nào.</p>
                  </div>
                ) : (
                  <div className="recent-event-list">
                    {recentConcerts.map((concert) => (
                      <Link key={concert.id} to="/admin/concerts" className="recent-event-row">
                        <div>
                          <div className="recent-event-main">
                            <strong>{concert.title}</strong>
                            <span className={`badge badge-${concert.status}`}>{concert.status}</span>
                          </div>
                          <div className="recent-event-meta">
                            <span>
                              <MapPin size={14} />
                              {concert.location}
                            </span>
                            <span>
                              <Clock3 size={14} />
                              {new Date(concert.startTime).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <ArrowRight size={18} />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <h3 className="panel-title">Tiến độ bán vé</h3>
                {salesProgress.length === 0 ? (
                  <div className="soft-panel">
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Chưa có dữ liệu hạng vé.</p>
                  </div>
                ) : (
                  <div className="dashboard-progress-list">
                    {salesProgress.map((summary) => (
                      <div key={summary.concertId} className="dashboard-progress-row">
                        <div className="dashboard-progress-header">
                          <strong>{summary.title}</strong>
                          <span>{summary.failed ? 'Lỗi dữ liệu' : `${summary.fillRate}%`}</span>
                        </div>
                        <div className="progress-track" aria-hidden="true">
                          <div className="progress-fill" style={{ width: `${summary.fillRate}%` }} />
                        </div>
                        <div className="dashboard-progress-meta">
                          <span>
                            {summary.soldTickets} / {summary.totalTickets} vé
                          </span>
                          <span>Còn lại {summary.availableTickets}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
