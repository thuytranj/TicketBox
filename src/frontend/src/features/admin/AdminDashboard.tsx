import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import type { Concert } from '../concerts/ConcertList';
import { ArrowRight, Calendar, Clock3, MapPin, Music, Plus } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchConcerts = async () => {
      try {
        const response = await apiClient.request<{ data: { concerts: Concert[] } }>('/concerts');
        setConcerts(response.data.concerts || []);
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

  return (
    <div className="container">
      <header className="section-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Theo dõi nhanh tình trạng sự kiện và các thao tác quan trọng.</p>
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
          </div>

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
                              {new Date(concert.start_time).toLocaleDateString()}
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
          </div>
        </>
      )}
    </div>
  );
};
