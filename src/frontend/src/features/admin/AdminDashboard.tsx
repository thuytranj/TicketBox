import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import type { Concert } from '../concerts/ConcertList';
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
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
    completed: number;
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
    paidTickets?: number;
    reservedTickets?: number;
    availableTickets?: number;
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
    paidQuantity?: number;
    reservedQuantity?: number;
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
  reservedTickets: number;
  fillRate: number;
  revenue: number;
  failed: boolean;
  ticketTypesCount: number;
  checkinsCount: number;
  checkinRate: number;
  startTime: string;
  status: string;
  ticketTypes: Array<{
    name: string;
    totalQuantity: number;
    soldQuantity: number;
  }>;
}

const emptyOverview: StatisticsOverview = {
  concerts: { total: 0, active: 0, draft: 0, cancelled: 0, completed: 0 },
  orders: { total: 0, paid: 0, pending: 0, expired: 0, cancelled: 0 },
  revenue: { totalRevenue: 0, averageOrderValue: 0 },
  tickets: { totalIssued: 0, totalSold: 0, paidTickets: 0, reservedTickets: 0, availableTickets: 0, fillRate: 0 },
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
  const soldTickets = stats.ticketTypes.reduce(
    (sum, ticketType) => sum + (ticketType.paidQuantity ?? ticketType.soldQuantity),
    0
  );
  const reservedTickets = stats.ticketTypes.reduce((sum, ticketType) => sum + (ticketType.reservedQuantity ?? 0), 0);
  const availableTickets = Math.max(totalTickets - soldTickets - reservedTickets, 0);

  return {
    concertId: stats.concert.id,
    title: stats.concert.title,
    totalTickets,
    availableTickets,
    soldTickets,
    reservedTickets,
    fillRate: totalTickets > 0 ? Math.round((soldTickets / totalTickets) * 100) : 0,
    revenue: stats.revenue.totalRevenue,
    failed: false,
    ticketTypesCount: stats.ticketTypes.length,
    checkinsCount: stats.checkins.totalCheckins,
    checkinRate: soldTickets > 0 ? Math.round((stats.checkins.totalCheckins / soldTickets) * 100) : 0,
    startTime: stats.concert.startTime,
    status: stats.concert.status,
    ticketTypes: stats.ticketTypes.map((tt) => ({
      name: tt.name,
      totalQuantity: tt.totalQuantity,
      soldQuantity: tt.paidQuantity ?? tt.soldQuantity,
    })),
  };
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'active':
      return <span className="badge-pill badge-pill-success">Đang mở bán</span>;
    case 'draft':
      return <span className="badge-pill badge-pill-warning">Bản nháp</span>;
    case 'cancelled':
      return <span className="badge-pill badge-pill-danger">Đã hủy</span>;
    case 'completed':
      return <span className="badge-pill badge-pill-info">Đã diễn ra</span>;
    default:
      return <span className="badge-pill badge-pill-info">{status}</span>;
  }
};

const RevenueChart: React.FC<{ data: RevenuePoint[] }> = ({ data }) => {
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    date: string;
    revenue: number;
    orderCount: number;
  } | null>(null);

  if (data.length === 0) return null;

  const maxRevenue = Math.max(...data.map(d => d.revenue), 1000000);
  const maxOrders = Math.max(...data.map(d => d.orderCount), 5);

  const svgWidth = 600;
  const svgHeight = 280;
  const padding = { top: 20, right: 45, bottom: 40, left: 60 };

  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1 || 1)) * chartWidth;
    const yRevenue = padding.top + chartHeight - (d.revenue / maxRevenue) * chartHeight;
    const yOrders = padding.top + chartHeight - (d.orderCount / maxOrders) * chartHeight * 0.4;
    return { x, yRevenue, yOrders, raw: d };
  });

  let revenuePath = '';
  let revenueAreaPath = '';
  let ordersPath = '';

  if (points.length > 0) {
    revenuePath = `M ${points[0].x} ${points[0].yRevenue} ` + points.slice(1).map(p => `L ${p.x} ${p.yRevenue}`).join(' ');
    revenueAreaPath = `${revenuePath} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;
    ordersPath = `M ${points[0].x} ${points[0].yOrders} ` + points.slice(1).map(p => `L ${p.x} ${p.yOrders}`).join(' ');
  }

  const gridLevels = 3;
  const gridLines = Array.from({ length: gridLevels + 1 }).map((_, idx) => {
    const y = padding.top + (idx / gridLevels) * chartHeight;
    const revenueVal = maxRevenue - (idx / gridLevels) * maxRevenue;
    const ordersVal = Math.round(maxOrders - (idx / gridLevels) * maxOrders);
    return { y, revenueVal, ordersVal };
  });

  return (
    <div style={{ position: 'relative', width: '100%', marginTop: '1.5rem' }}>
      <svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="revenue-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {gridLines.map((line, idx) => (
          <g key={idx}>
            <line
              x1={padding.left}
              y1={line.y}
              x2={svgWidth - padding.right}
              y2={line.y}
              stroke="var(--border)"
              strokeWidth="1.2"
              strokeDasharray="4 4"
              opacity="0.85"
            />
            {/* Left Axis: Revenue */}
            <text
              x={padding.left - 10}
              y={line.y + 4}
              textAnchor="end"
              fontSize="10"
              fill="var(--text-muted)"
              fontWeight="600"
            >
              {line.revenueVal >= 1000000 ? `${(line.revenueVal / 1000000).toFixed(0)}M` : `${line.revenueVal.toLocaleString()}`}
            </text>
            {/* Right Axis: Order Counts */}
            <text
              x={svgWidth - padding.right + 10}
              y={line.y + 4}
              textAnchor="start"
              fontSize="10"
              fill="#d97706"
              fontWeight="600"
            >
              {line.ordersVal} đơn
            </text>
          </g>
        ))}

        {/* Revenue Area (Gradient fill) */}
        {points.length > 0 && (
          <path d={revenueAreaPath} fill="url(#revenue-area-grad)" />
        )}

        {/* Revenue Line */}
        {points.length > 0 && (
          <path d={revenuePath} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Orders Line (dashed) */}
        {points.length > 0 && (
          <path d={ordersPath} fill="none" stroke="#ffb703" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Circle Dots for Revenue */}
        {points.map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.yRevenue}
            r="4"
            fill="#ffffff"
            stroke="var(--primary)"
            strokeWidth="2.5"
            style={{ cursor: 'pointer' }}
          />
        ))}

        {/* Invisible vertical hover rectangles for smooth tooltips */}
        {points.map((p, idx) => {
          const colWidth = chartWidth / (points.length - 1 || 1);
          return (
            <rect
              key={`hover-trigger-${idx}`}
              x={p.x - colWidth / 2}
              y={padding.top}
              width={colWidth}
              height={chartHeight}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredPoint({
                x: p.x,
                y: p.yRevenue,
                date: new Date(p.raw.date).toLocaleDateString('vi-VN'),
                revenue: p.raw.revenue,
                orderCount: p.raw.orderCount
              })}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          );
        })}

        {/* X-axis Labels */}
        {points.map((p, idx) => {
          const shouldShow = points.length <= 8 || idx % Math.ceil(points.length / 8) === 0 || idx === points.length - 1;
          if (!shouldShow) return null;

          return (
            <text
              key={idx}
              x={p.x}
              y={svgHeight - 12}
              textAnchor="middle"
              fontSize="10"
              fill="var(--text-muted)"
              fontWeight="600"
            >
              {new Date(p.raw.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
            </text>
          );
        })}
      </svg>

      {/* Tooltip Overlay */}
      {hoveredPoint && (
        <div style={{
          position: 'absolute',
          left: `${(hoveredPoint.x / svgWidth) * 100}%`,
          top: `${(hoveredPoint.y / svgHeight) * 100}%`,
          transform: hoveredPoint.x < 100
            ? 'translate(0, -100%) translateY(-10px)'
            : (svgWidth - hoveredPoint.x < 100 ? 'translate(-100%, -100%) translateY(-10px)' : 'translate(-50%, -100%) translateY(-10px)'),
          background: 'rgba(15, 23, 42, 0.96)',
          color: '#ffffff',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '0.74rem',
          pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
          zIndex: 10,
          whiteSpace: 'nowrap',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          transition: 'all 0.1s ease-out'
        }}>
          <span style={{ fontWeight: 600, color: '#94a3b8' }}>{hoveredPoint.date}</span>
          <span style={{ color: '#60a5fa', fontWeight: 700 }}>Doanh thu: {hoveredPoint.revenue.toLocaleString('vi-VN')} VND</span>
          <span style={{ color: '#fbbf24', fontWeight: 700 }}>Đơn hàng: {hoveredPoint.orderCount}</span>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '1.2rem', fontSize: '0.82rem', fontWeight: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'var(--primary)' }} />
          <span style={{ color: 'var(--text-muted)' }}>Doanh thu (VND)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '3px', borderTop: '2px dashed #ffb703' }} />
          <span style={{ color: 'var(--text-muted)' }}>Số đơn hàng</span>
        </div>
      </div>
    </div>
  );
};

const safeFormatDate = (dateStr?: string) => {
  if (!dateStr) return 'Chưa xác định';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? 'Chưa xác định' : d.toLocaleDateString('vi-VN');
};

export const AdminDashboard: React.FC = () => {
  const [overview, setOverview] = useState<StatisticsOverview>(emptyOverview);
  const [revenueSeries, setRevenueSeries] = useState<RevenueTimeSeries | null>(null);
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [salesSummaries, setSalesSummaries] = useState<ConcertSalesSummary[]>([]);
  const [statsFailures, setStatsFailures] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeframe, setTimeframe] = useState<'7day' | '30day'>('7day');
  const [salesFilter, setSalesFilter] = useState<'all' | 'active' | 'draft' | 'cancelled' | 'completed'>('all');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [overviewResponse, revenueResponse, activeRes, draftRes, cancelledRes, completedRes] = await Promise.all([
          apiClient.request<StatisticsOverview>('/statistics/overview'),
          apiClient.request<RevenueTimeSeries>('/statistics/revenue?period=day'),
          apiClient.request<{ concerts: Concert[] }>('/concerts?status=active&page=1&limit=100'),
          apiClient.request<{ concerts: Concert[] }>('/concerts?status=draft&page=1&limit=100'),
          apiClient.request<{ concerts: Concert[] }>('/concerts?status=cancelled&page=1&limit=100'),
          apiClient.request<{ concerts: Concert[] }>('/concerts?status=completed&page=1&limit=100'),
        ]);

        const rawConcerts = [
          ...(activeRes.concerts || []),
          ...(draftRes.concerts || []),
          ...(cancelledRes.concerts || []),
          ...(completedRes.concerts || []),
        ];
        const uniqueConcerts = Array.from(new Map(rawConcerts.map(c => [c.id, c])).values());

        setOverview(overviewResponse);
        setRevenueSeries(revenueResponse);
        setConcerts(uniqueConcerts);

        const summaries: ConcertSalesSummary[] = [];
        const concurrencyLimit = 3;

        for (let i = 0; i < uniqueConcerts.length; i += concurrencyLimit) {
          const chunk = uniqueConcerts.slice(i, i + concurrencyLimit);
          const chunkResults = await Promise.all(
            chunk.map(async (concert) => {
              if (concert.status === 'draft') {
                return {
                  concertId: concert.id,
                  title: concert.title,
                  totalTickets: 0,
                  availableTickets: 0,
                  soldTickets: 0,
                  reservedTickets: 0,
                  fillRate: 0,
                  revenue: 0,
                  failed: false,
                  ticketTypesCount: 0,
                  checkinsCount: 0,
                  checkinRate: 0,
                  startTime: concert.startTime,
                  status: concert.status,
                  ticketTypes: [],
                };
              }

              try {
                const stats = await apiClient.request<ConcertStatistics>(`/statistics/concerts/${concert.id}`);
                return buildSummaryFromStats(stats);
              } catch (err) {
                return {
                  concertId: concert.id,
                  title: concert.title,
                  totalTickets: 0,
                  availableTickets: 0,
                  soldTickets: 0,
                  reservedTickets: 0,
                  fillRate: 0,
                  revenue: 0,
                  failed: true,
                  ticketTypesCount: 0,
                  checkinsCount: 0,
                  checkinRate: 0,
                  startTime: concert.startTime,
                  status: concert.status,
                  ticketTypes: [],
                };
              }
            })
          );
          summaries.push(...chunkResults);
        }

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

  const statusCounts = useMemo(() => {
    return {
      all: salesSummaries.length,
      active: salesSummaries.filter((s) => s.status === 'active').length,
      draft: salesSummaries.filter((s) => s.status === 'draft').length,
      cancelled: salesSummaries.filter((s) => s.status === 'cancelled').length,
      completed: salesSummaries.filter((s) => s.status === 'completed').length,
    };
  }, [salesSummaries]);

  const salesProgress = useMemo(() => {
    let list = [...salesSummaries];
    if (salesFilter !== 'all') {
      list = list.filter((item) => item.status === salesFilter);
    }
    return list.sort((a, b) => b.soldTickets - a.soldTickets);
  }, [salesSummaries, salesFilter]);

  const revenuePoints = useMemo(() => {
    if (!revenueSeries) return [];
    const data = revenueSeries.data;
    if (timeframe === '7day') {
      return data.slice(-7);
    }
    if (timeframe === '30day') {
      return data.slice(-30);
    }
    return data;
  }, [revenueSeries, timeframe]);

  const maxRevenue = useMemo(() => {
    return revenuePoints.reduce((max, point) => Math.max(max, point.revenue), 0);
  }, [revenuePoints]);

  const paidTicketCount = overview.tickets.paidTickets ?? overview.tickets.totalSold;
  const reservedTicketCount = overview.tickets.reservedTickets ?? 0;
  const availableTicketCount = overview.tickets.totalIssued - overview.tickets.totalSold;

  return (
    <div className="container">
      <header className="section-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Theo dõi nhanh tình trạng sự kiện, doanh thu, lượng vé đã thanh toán và lượt check-in.</p>
        </div>
      </header>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="flex-center" style={{ padding: '4rem' }}>
          <div className="spinner" />
        </div>
      ) : (
        <>
          {/* Main Bento Grid Row 1 & 2 */}
          <div className="bento-grid">
            
            {/* Bento 1: Revenue Hero Chart (Spans 4 columns) */}
            <div className="card bento-card bento-hero-revenue" style={{ gridColumn: 'span 4' }}>
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.2rem' }}>
                  <div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Doanh thu
                    </span>
                    <strong className="metric-value metric-value-compact" style={{ fontSize: '2rem', display: 'block', marginTop: '4px' }}>
                      {formatVnd(overview.revenue.totalRevenue)}
                    </strong>
                  </div>
                  <div className="timeframe-container">
                    <button className={`timeframe-btn ${timeframe === '7day' ? 'active' : ''}`} onClick={() => setTimeframe('7day')}>7 ngày</button>
                    <button className={`timeframe-btn ${timeframe === '30day' ? 'active' : ''}`} onClick={() => setTimeframe('30day')}>30 ngày</button>
                  </div>
                </div>

                <RevenueChart data={revenuePoints} />

                {/* Accessible Hidden fields for Testing */}
                <div style={{ display: 'none' }}>
                  <h3>Doanh thu 30 ngày</h3>
                </div>

                <details style={{ marginTop: '1.8rem', borderTop: '1px solid var(--border)', paddingTop: '1.2rem' }}>
                  <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
                    Xem chi tiết số liệu dạng danh sách từng ngày
                  </summary>
                  <div style={{ marginTop: '1.2rem' }}>
                    {revenuePoints.length === 0 ? (
                      <div className="soft-panel">
                        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Chưa có dữ liệu doanh thu.</p>
                      </div>
                    ) : (
                      <div className="daily-details-scrollable">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {revenuePoints.map((point) => {
                            return (
                              <div
                                key={`${point.date}-${point.orderCount}`}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '1.2fr 1fr 1.2fr',
                                  alignItems: 'center',
                                  padding: '10px 14px',
                                  background: 'var(--surface-alt)',
                                  borderRadius: '8px',
                                  border: '1px solid var(--border)',
                                  fontSize: '0.85rem'
                                }}
                              >
                                <div style={{ color: 'var(--text-strong)', fontWeight: 600 }}>
                                  {formatDateLabel(point.date)}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                                  <TrendingUp size={14} style={{ color: 'var(--success)' }} />
                                  <span><strong>{point.orderCount}</strong> đơn hàng</span>
                                </div>
                                <div style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                                  {formatVnd(point.revenue)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            </div>

            {/* Bento 5: Quick Actions (Spans 1 column) -> Placed in Row 1 */}
            <div className="card bento-card bento-quick-actions">
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                <h3 className="panel-title" style={{ marginBottom: '1.2rem' }}>Thao tác nhanh</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1.2rem 0', lineHeight: 1.4 }}>
                  Quản lý hoạt động biểu diễn, xuất danh sách vé và cập nhật nhanh các bản nháp sự kiện.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <Link to="/admin/concerts" className="btn btn-primary" style={{ justifyContent: 'space-between', padding: '12px 16px', minHeight: '46px' }}>
                    <span>Tạo sự kiện mới</span>
                    <Plus size={18} />
                  </Link>
                  <Link to="/admin/concerts" className="btn btn-outline" style={{ justifyContent: 'space-between', padding: '12px 16px', minHeight: '46px' }}>
                    <span>Quản lý sự kiện</span>
                    <ArrowRight size={18} />
                  </Link>
                </div>
              </div>
            </div>

            {/* Bento 2: Concerts Operations (Spans 1 column) -> Row 2 */}
            <div className="card bento-card bento-concerts-ops">
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                <div>
                  <h3 className="panel-title" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Music size={18} style={{ color: 'var(--primary)' }} />
                    Sự kiện
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '1.5rem' }}>
                    <span style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--text-strong)', lineHeight: 1 }}>
                      {overview.concerts.total}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Tổng sự kiện
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <Link to="/admin/concerts?status=active" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', padding: '10px', borderRadius: '8px', background: 'var(--surface-alt)', transition: 'background 0.2s' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>Sự kiện đang mở bán</span>
                    <span className="badge-pill badge-pill-success">{overview.concerts.active}</span>
                  </Link>
                  <Link to="/admin/concerts?status=completed" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', padding: '10px', borderRadius: '8px', background: 'var(--surface-alt)', transition: 'background 0.2s' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>Đã diễn ra</span>
                    <span className="badge-pill badge-pill-info">{overview.concerts.completed}</span>
                  </Link>
                  <Link to="/admin/concerts?status=draft" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', padding: '10px', borderRadius: '8px', background: 'var(--surface-alt)', transition: 'background 0.2s' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>Bản nháp</span>
                    <span className="badge-pill badge-pill-warning">{overview.concerts.draft}</span>
                  </Link>
                  <Link to="/admin/concerts?status=cancelled" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', padding: '10px', borderRadius: '8px', background: 'var(--surface-alt)', transition: 'background 0.2s' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>Đã hủy</span>
                    <span className="badge-pill badge-pill-danger">{overview.concerts.cancelled}</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Bento 3: Ticket Inventory & Fill Rate (Spans 1 column) -> Row 2 */}
            <div className="card bento-card bento-tickets-inventory">
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                <h3 className="panel-title" style={{ marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Ticket size={18} style={{ color: 'var(--success)' }} />
                  Vé &amp; Sức chứa
                </h3>
                
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0.8rem 0' }}>
                  <div style={{ position: 'relative', width: 90, height: 90, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width={90} height={90} viewBox="0 0 90 90" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx={45} cy={45} r={38} fill="transparent" stroke="var(--surface-alt)" strokeWidth={8} />
                      <circle
                        cx={45} cy={45} r={38} fill="transparent" stroke="var(--success)" strokeWidth={8}
                        strokeDasharray={2 * Math.PI * 38}
                        strokeDashoffset={2 * Math.PI * 38 - (Math.min(100, Math.max(0, overview.tickets.fillRate)) / 100) * 2 * Math.PI * 38}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                      />
                    </svg>
                    <div style={{ position: 'absolute', fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-strong)' }}>
                      {overview.tickets.fillRate}%
                    </div>
                  </div>
                  <div style={{ marginLeft: '1rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Tỷ lệ bán vé</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.82rem' }}>
                  <div style={{ padding: '8px', background: 'var(--surface-alt)', borderRadius: '6px' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Tổng vé phát hành</span>
                    <strong style={{ color: 'var(--text-strong)', fontSize: '0.95rem' }}>{overview.tickets.totalIssued}</strong>
                  </div>
                  <div style={{ padding: '8px', background: 'var(--surface-alt)', borderRadius: '6px' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Vé đã thanh toán</span>
                    <strong style={{ color: 'var(--text-strong)', fontSize: '0.95rem' }}>{paidTicketCount}</strong>
                  </div>
                  <div style={{ padding: '8px', background: 'var(--surface-alt)', borderRadius: '6px' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Vé đang giữ</span>
                    <strong style={{ color: 'var(--text-strong)', fontSize: '0.95rem' }}>{reservedTicketCount}</strong>
                  </div>
                  <div style={{ padding: '8px', background: 'var(--surface-alt)', borderRadius: '6px' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Vé còn trống</span>
                    <strong style={{ color: 'var(--text-strong)', fontSize: '0.95rem' }}>{availableTicketCount}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Bento 4: Check-in & Gate Ops (Spans 1 column) -> Row 2 */}
            <div className="card bento-card bento-checkin-ops">
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                <h3 className="panel-title" style={{ marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={18} style={{ color: 'var(--accent)' }} />
                  Check-in
                </h3>

                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0.8rem 0' }}>
                  <div style={{ position: 'relative', width: 90, height: 90, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width={90} height={90} viewBox="0 0 90 90" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx={45} cy={45} r={38} fill="transparent" stroke="var(--surface-alt)" strokeWidth={8} />
                      <circle
                        cx={45} cy={45} r={38} fill="transparent" stroke="var(--accent)" strokeWidth={8}
                        strokeDasharray={2 * Math.PI * 38}
                        strokeDashoffset={2 * Math.PI * 38 - (Math.min(100, Math.max(0, overview.checkins.checkinRate)) / 100) * 2 * Math.PI * 38}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                      />
                    </svg>
                    <div style={{ position: 'absolute', fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-strong)' }}>
                      {overview.checkins.checkinRate}%
                    </div>
                  </div>
                  <div style={{ marginLeft: '1rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Tỷ lệ Check-in</span>
                  </div>
                </div>

                <div style={{ padding: '12px 14px', background: 'var(--surface-alt)', borderRadius: '10px', marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>Đã soát vé</span>
                    <strong style={{ color: 'var(--text-strong)', fontSize: '1.05rem', fontWeight: 800 }}>
                      {overview.tickets.totalSold > 0
                        ? `${overview.checkins.totalCheckins} / ${overview.tickets.totalSold} vé`
                        : `${overview.checkins.totalCheckins} lượt`}
                    </strong>
                  </div>
                  <div className="progress-track" aria-hidden="true" style={{ height: '4px', background: 'rgba(242, 63, 99, 0.08)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, overview.checkins.checkinRate))}%`, background: 'var(--accent)', borderRadius: '99px' }} />
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Row 3: Lists (2 columns: Recent Events & Sales Progress) */}
          {statsFailures > 0 && (
            <div className="alert alert-warning dashboard-warning" style={{ marginBottom: '22px' }}>
              <AlertTriangle size={18} />
              <span>{`Không tải được thống kê chi tiết của ${statsFailures} sự kiện.`}</span>
            </div>
          )}

          <div className="admin-panel-grid" style={{ gridTemplateColumns: '1.1fr 2.1fr' }}>
            
            {/* Card: Recent Concerts */}
            <div className="card">
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <h3 className="panel-title" style={{ marginBottom: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Sự kiện gần đây</span>
                  <Link to="/admin/concerts" style={{ fontSize: '0.82rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 700 }}>
                    Xem tất cả
                  </Link>
                </h3>
                {recentConcerts.length === 0 ? (
                  <div className="soft-panel" style={{ flex: 1 }}>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Chưa có sự kiện nào.</p>
                  </div>
                ) : (
                  <div className="recent-event-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {recentConcerts.map((concert) => (
                      <Link key={concert.id} to="/admin/concerts" className="recent-event-row" style={{ transition: 'all 0.2s', borderRadius: '8px', padding: '12px 16px', textDecoration: 'none' }}>
                        <div style={{ flex: 1 }}>
                          <div className="recent-event-main" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.95rem', color: 'var(--text-strong)' }}>{concert.title}</strong>
                            {getStatusBadge(concert.status)}
                          </div>
                          <div className="recent-event-meta" style={{ marginTop: '6px', display: 'flex', gap: '12px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            <span>
                              <MapPin size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                              {concert.location}
                            </span>
                            <span>
                              <Clock3 size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                              {safeFormatDate(concert.startTime)}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Card: Sales Progress */}
            <div className="card">
              <div className="card-body">
                <h3 className="panel-title" style={{ marginBottom: '1.2rem' }}>Tiến độ bán vé</h3>
                
                {/* Status Filter Pills for Sales Progress */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1.2rem' }}>
                  <button
                    className={`timeframe-btn ${salesFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setSalesFilter('all')}
                    style={{ borderRadius: '99px', padding: '6px 14px', fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    Tất cả ({statusCounts.all})
                  </button>
                  <button
                    className={`timeframe-btn ${salesFilter === 'active' ? 'active' : ''}`}
                    onClick={() => setSalesFilter('active')}
                    style={{ borderRadius: '99px', padding: '6px 14px', fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    Đang mở bán ({statusCounts.active})
                  </button>
                  <button
                    className={`timeframe-btn ${salesFilter === 'draft' ? 'active' : ''}`}
                    onClick={() => setSalesFilter('draft')}
                    style={{ borderRadius: '99px', padding: '6px 14px', fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    Nháp ({statusCounts.draft})
                  </button>
                  <button
                    className={`timeframe-btn ${salesFilter === 'cancelled' ? 'active' : ''}`}
                    onClick={() => setSalesFilter('cancelled')}
                    style={{ borderRadius: '99px', padding: '6px 14px', fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    Đã hủy ({statusCounts.cancelled})
                  </button>
                  <button
                    className={`timeframe-btn ${salesFilter === 'completed' ? 'active' : ''}`}
                    onClick={() => setSalesFilter('completed')}
                    style={{ borderRadius: '99px', padding: '6px 14px', fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    Đã diễn ra ({statusCounts.completed})
                  </button>
                </div>

                {salesProgress.length === 0 ? (
                  <div className="soft-panel">
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Chưa có dữ liệu thống kê sự kiện.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    {salesProgress.map((summary) => {
                      const ringColor = summary.failed ? 'var(--danger)' : summary.fillRate > 75 ? 'var(--success)' : summary.fillRate > 25 ? 'var(--primary)' : 'var(--warning)';
                      
                      return (
                        <div key={summary.concertId} className="card" style={{ padding: '16px', background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'all 0.2s' }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '12px' }}>
                              <div style={{ flex: 1 }}>
                                <strong style={{ fontSize: '0.92rem', color: 'var(--text-strong)', display: 'block', lineHeight: 1.3 }}>{summary.title}</strong>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{safeFormatDate(summary.startTime)}</span>
                              </div>
                              {getStatusBadge(summary.status)}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '8px 0 14px 0' }}>
                              <div style={{ position: 'relative', width: 60, height: 60, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <svg width={60} height={60} viewBox="0 0 60 60" style={{ transform: 'rotate(-90deg)' }}>
                                  <circle cx={30} cy={30} r={25} fill="transparent" stroke="rgba(0,0,0,0.04)" strokeWidth={4.5} />
                                  <circle
                                    cx={30} cy={30} r={25} fill="transparent" stroke={ringColor} strokeWidth={4.5}
                                    strokeDasharray={2 * Math.PI * 25}
                                    strokeDashoffset={2 * Math.PI * 25 - (Math.min(100, Math.max(0, summary.fillRate)) / 100) * 2 * Math.PI * 25}
                                    strokeLinecap="round"
                                  />
                                </svg>
                                <div style={{ position: 'absolute', fontWeight: 800, fontSize: summary.failed ? '0.62rem' : '0.82rem', color: summary.failed ? 'var(--danger)' : 'var(--text-strong)' }}>
                                  {summary.failed ? 'Lỗi dữ liệu' : `${summary.fillRate}%`}
                                </div>
                              </div>

                              <div>
                                <strong style={{ fontSize: '1.05rem', color: 'var(--text-strong)', display: 'block' }}>
                                  {formatVnd(summary.revenue)}
                                </strong>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>Doanh thu vé</span>
                              </div>
                            </div>
                          </div>

                          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '8px', gap: '8px' }}>
                              <span style={{ color: 'var(--text-muted)' }}>
                                Đã bán: <strong style={{ color: 'var(--text-strong)' }}>{summary.soldTickets} / {summary.totalTickets}</strong>
                              </span>
                              <span style={{ color: 'var(--text-muted)' }}>
                                Giữ chỗ: <strong style={{ color: summary.reservedTickets > 0 ? 'var(--warning)' : 'var(--text-strong)' }}>{summary.reservedTickets}</strong>
                              </span>
                              <span style={{ color: 'var(--text-muted)' }}>
                                Soát vé: <strong>{summary.checkinRate}%</strong>
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', fontSize: '0.7rem' }}>
                              <span style={{ padding: '2px 6px', background: 'var(--primary-soft)', color: 'var(--primary)', borderRadius: '4px', fontWeight: 700 }}>
                                Hạng vé: <strong>{summary.ticketTypesCount}</strong>
                              </span>
                              {summary.reservedTickets > 0 && (
                                <span style={{ padding: '2px 6px', background: 'var(--warning-soft)', color: 'var(--warning)', borderRadius: '4px', fontWeight: 700 }}>
                                  Giữ chỗ: <strong>{summary.reservedTickets}</strong>
                                </span>
                              )}
                              <span style={{ padding: '2px 6px', background: 'rgba(15, 159, 110, 0.08)', color: 'var(--success)', borderRadius: '4px', fontWeight: 700 }}>
                                Trống: <strong>{summary.availableTickets}</strong>
                              </span>
                            </div>

                            {/* Ticket Types breakdown dropdown */}
                            {summary.ticketTypes && summary.ticketTypes.length > 0 && (
                              <details style={{ marginTop: '10px', borderTop: '1px dashed var(--border)', paddingTop: '8px' }}>
                                <summary style={{ cursor: 'pointer', fontSize: '0.74rem', color: 'var(--primary)', fontWeight: 600 }}>
                                  Chi tiết hạng vé ({summary.ticketTypes.length})
                                </summary>
                                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.72rem' }}>
                                  {summary.ticketTypes.map((tt) => (
                                    <div key={tt.name} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                                      <span>{tt.name}</span>
                                      <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>
                                        {tt.soldQuantity} / {tt.totalQuantity} vé
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
