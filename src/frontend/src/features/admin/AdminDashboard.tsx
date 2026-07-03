import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import type { Concert } from '../concerts/ConcertList';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Clock3,
  DollarSign,
  MapPin,
  Music,
  Plus,
  Ticket,
  TrendingUp,
  Users,
} from 'lucide-react';

interface StatisticsOverview {
  concerts: {
    total: number;
    active: number;
    draft: number;
    cancelled: number;
  };
  orders: {
    total: number;
    paid: number;
    pending: number;
    expired: number;
    cancelled: number;
  };
  revenue: {
    totalRevenue: number;
    averageOrderValue: number;
  };
  tickets: {
    totalIssued: number;
    totalSold: number;
    fillRate: number;
  };
  checkins: {
    totalCheckins: number;
    checkinRate: number;
  };
}

interface RevenuePoint {
  date: string;
  revenue: number;
  orderCount: number;
}

interface RevenueTimeSeries {
  period: 'day' | 'week' | 'month';
  from: string;
  to: string;
  data: RevenuePoint[];
}

interface ConcertStatistics {
  concert: {
    id: string;
    title: string;
    status: Concert['status'];
    startTime: string;
  };
  revenue: {
    totalRevenue: number;
    paidOrderCount: number;
  };
  ticketTypes: Array<{
    name: string;
    price: number;
    totalQuantity: number;
    availableQuantity: number;
    soldQuantity: number;
    revenue: number;
  }>;
  checkins: {
    ticketCheckins: number;
    vipGuestCheckins: number;
    totalCheckins: number;
  };
}

interface ConcertSalesSummary {
  concertId: string;
  title: string;
  totalTickets: number;
  availableTickets: number;
  soldTickets: number;
  fillRate: number;
  revenue: number;
  failed: boolean;
}

const emptyOverview: StatisticsOverview = {
  concerts: { total: 0, active: 0, draft: 0, cancelled: 0 },
  orders: { total: 0, paid: 0, pending: 0, expired: 0, cancelled: 0 },
  revenue: { totalRevenue: 0, averageOrderValue: 0 },
  tickets: { totalIssued: 0, totalSold: 0, fillRate: 0 },
  checkins: { totalCheckins: 0, checkinRate: 0 },
};

const formatVnd = (amount: number) => `${Math.round(amount).toLocaleString('vi-VN')} VND`;

const formatDateLabel = (date: string) =>
  new Date(date).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  });

const buildSummaryFromStats = (stats: ConcertStatistics): ConcertSalesSummary => {
  const totalTickets = stats.ticketTypes.reduce((sum, ticketType) => sum + ticketType.totalQuantity, 0);
  const availableTickets = stats.ticketTypes.reduce((sum, ticketType) => sum + ticketType.availableQuantity, 0);
  const soldTickets = stats.ticketTypes.reduce((sum, ticketType) => sum + ticketType.soldQuantity, 0);

  return {
    concertId: stats.concert.id,
    title: stats.concert.title,
    totalTickets,
    availableTickets,
    soldTickets,
    fillRate: totalTickets > 0 ? Math.round((soldTickets / totalTickets) * 100) : 0,
    revenue: stats.revenue.totalRevenue,
    failed: false,
  };
};

export const AdminDashboard: React.FC = () => {
  const [overview, setOverview] = useState<StatisticsOverview>(emptyOverview);
  const [revenueSeries, setRevenueSeries] = useState<RevenueTimeSeries | null>(null);
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [salesSummaries, setSalesSummaries] = useState<ConcertSalesSummary[]>([]);
  const [statsFailures, setStatsFailures] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [overviewResponse, revenueResponse, concertResponse] = await Promise.all([
          apiClient.request<StatisticsOverview>('/statistics/overview'),
          apiClient.request<RevenueTimeSeries>('/statistics/revenue?period=day'),
          apiClient.request<{ concerts: Concert[] }>('/concerts?page=1&limit=100'),
        ]);

        const loadedConcerts = concertResponse.concerts || [];
        setOverview(overviewResponse);
        setRevenueSeries(revenueResponse);
        setConcerts(loadedConcerts);

        const concertStatsResults = await Promise.allSettled(
          loadedConcerts.map((concert) =>
            apiClient.request<ConcertStatistics>(`/statistics/concerts/${concert.id}`)
          )
        );

        const summaries = concertStatsResults.map((result, index) => {
          if (result.status === 'fulfilled') {
            return buildSummaryFromStats(result.value);
          }

          return {
            concertId: loadedConcerts[index].id,
            title: loadedConcerts[index].title,
            totalTickets: 0,
            availableTickets: 0,
            soldTickets: 0,
            fillRate: 0,
            revenue: 0,
            failed: true,
          };
        });

        setSalesSummaries(summaries);
        setStatsFailures(summaries.filter((summary) => summary.failed).length);
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const recentConcerts = concerts.slice(0, 5);
  const salesProgress = [...salesSummaries].sort((a, b) => b.soldTickets - a.soldTickets).slice(0, 5);
  const revenuePoints = useMemo(() => revenueSeries?.data.slice(-8) || [], [revenueSeries]);
  const maxRevenue = revenuePoints.reduce((max, point) => Math.max(max, point.revenue), 0);

  return (
    <div className="container">
      <header className="section-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Theo dõi nhanh tình trạng sự kiện, doanh thu, lượng vé đã bán và check-in từ Statistics API.</p>
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
              <strong className="metric-value">{overview.concerts.total}</strong>
            </div>

            <div className="card metric-card">
              <div className="metric-label">
                <span>Đang bán</span>
                <Calendar size={20} style={{ color: 'var(--success)' }} />
              </div>
              <strong className="metric-value">{overview.concerts.active}</strong>
            </div>

            <div className="card metric-card">
              <div className="metric-label">
                <span>Bản nháp</span>
                <Calendar size={20} style={{ color: 'var(--warning)' }} />
              </div>
              <strong className="metric-value">{overview.concerts.draft}</strong>
            </div>

            <div className="card metric-card">
              <div className="metric-label">
                <span>Tổng vé phát hành</span>
                <Ticket size={20} style={{ color: 'var(--primary)' }} />
              </div>
              <strong className="metric-value">{overview.tickets.totalIssued}</strong>
            </div>

            <div className="card metric-card">
              <div className="metric-label">
                <span>Đã bán/giữ</span>
                <Ticket size={20} style={{ color: 'var(--success)' }} />
              </div>
              <strong className="metric-value">{overview.tickets.totalSold}</strong>
            </div>

            <div className="card metric-card">
              <div className="metric-label">
                <span>Tỷ lệ lấp đầy</span>
                <TrendingUp size={20} style={{ color: 'var(--accent)' }} />
              </div>
              <strong className="metric-value">{overview.tickets.fillRate}%</strong>
            </div>

            <div className="card metric-card">
              <div className="metric-label">
                <span>Doanh thu</span>
                <DollarSign size={20} style={{ color: 'var(--success)' }} />
              </div>
              <strong className="metric-value metric-value-compact">{formatVnd(overview.revenue.totalRevenue)}</strong>
            </div>

            <div className="card metric-card">
              <div className="metric-label">
                <span>Check-in</span>
                <Users size={20} style={{ color: 'var(--primary)' }} />
              </div>
              <strong className="metric-value">{overview.checkins.totalCheckins}</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{overview.checkins.checkinRate}% vé đã bán</span>
            </div>
          </div>

          {statsFailures > 0 && (
            <div className="alert alert-warning dashboard-warning">
              <AlertTriangle size={18} />
              <span>{`Không tải được thống kê chi tiết của ${statsFailures} concert.`}</span>
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
                <h3 className="panel-title">Doanh thu 30 ngày</h3>
                {revenuePoints.length === 0 ? (
                  <div className="soft-panel">
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Chưa có dữ liệu doanh thu.</p>
                  </div>
                ) : (
                  <div className="dashboard-progress-list">
                    {revenuePoints.map((point) => {
                      const width = maxRevenue > 0 ? Math.max((point.revenue / maxRevenue) * 100, 4) : 4;

                      return (
                        <div key={`${point.date}-${point.orderCount}`} className="dashboard-progress-row">
                          <div className="dashboard-progress-header">
                            <strong>{formatDateLabel(point.date)}</strong>
                            <span>{formatVnd(point.revenue)}</span>
                          </div>
                          <div className="progress-track" aria-hidden="true">
                            <div className="progress-fill" style={{ width: `${width}%` }} />
                          </div>
                          <div className="dashboard-progress-meta">
                            <span>{point.orderCount} đơn đã thanh toán</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                              {new Date(concert.startTime).toLocaleDateString('vi-VN')}
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
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Chưa có dữ liệu thống kê concert.</p>
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
                          <span>{formatVnd(summary.revenue)}</span>
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
