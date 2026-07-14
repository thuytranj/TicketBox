import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, RotateCcw, Search, Ticket } from 'lucide-react';
import heroPreview from '../../assets/hero.png';

export interface Concert {
  id: string;
  title: string;
  description: string;
  location: string;
  posterUrl: string;
  startTime: string;
  endTime?: string;
  tags: string[];
  status: 'draft' | 'active' | 'cancelled' | 'completed';
  biography?: string;
}

interface ConcertMeta {
  totalItems: number;
  itemCount: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
}

const PAGE_SIZE = 9;

export const ConcertList: React.FC = () => {
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [meta, setMeta] = useState<ConcertMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [cityFilter, setCityFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const fetchConcerts = async () => {
    setLoading(true);
    setError('');
    try {
      const tagParam = selectedTag ? `&tag=${selectedTag}` : '';
      const searchParam = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : '';

      if (statusFilter === 'all') {
        const [activeRes, completedRes] = await Promise.all([
          apiClient.request<{ concerts: Concert[] }>(
            `/concerts?status=active${tagParam}${searchParam}&page=1&limit=100`
          ),
          apiClient.request<{ concerts: Concert[] }>(
            `/concerts?status=completed${tagParam}${searchParam}&page=1&limit=100`
          ),
        ]);
        const activeList = activeRes?.concerts || [];
        const completedList = completedRes?.concerts || [];
        const combined = [...activeList, ...completedList];

        const uniqueMap = new Map<string, Concert>();
        combined.forEach((c) => {
          if (c.status === 'active' || c.status === 'completed') {
            uniqueMap.set(c.id, c);
          }
        });
        const uniqueList = Array.from(uniqueMap.values());

        uniqueList.sort(
          (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        );

        setConcerts(uniqueList);
        setMeta(null);
      } else {
        const response = await apiClient.request<{ concerts: Concert[]; meta?: ConcertMeta }>(
          `/concerts?status=${statusFilter}${tagParam}${searchParam}&page=${page}&limit=${PAGE_SIZE}`
        );
        setConcerts(response.concerts || []);
        setMeta(response.meta || null);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Không tải được danh sách sự kiện';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchConcerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, selectedTag, statusFilter]);

  const handleStatusFilterChange = (status: 'all' | 'active' | 'completed') => {
    setStatusFilter(status);
    setPage(1);
  };

  const handleTagChange = (tag: string) => {
    setSelectedTag(tag);
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const allTags = useMemo(() => Array.from(new Set(concerts.flatMap((c) => c.tags || []))), [concerts]);
  const featuredConcert = concerts[0];
  const heroImage = featuredConcert?.posterUrl || heroPreview;

  const filteredConcerts = useMemo(() => {
    if (!cityFilter) return concerts;
    const lowerCity = cityFilter.toLowerCase();
    if (lowerCity === 'khác') {
      return concerts.filter(
        (c) =>
          c.location &&
          !c.location.toLowerCase().includes('hồ chí minh') &&
          !c.location.toLowerCase().includes('hcm') &&
          !c.location.toLowerCase().includes('hà nội') &&
          !c.location.toLowerCase().includes('đà nẵng')
      );
    }
    return concerts.filter(
      (c) => c.location && c.location.toLowerCase().includes(lowerCity)
    );
  }, [concerts, cityFilter]);

  const paginatedConcerts = useMemo(() => {
    if (statusFilter === 'all') {
      const start = (page - 1) * PAGE_SIZE;
      return filteredConcerts.slice(start, start + PAGE_SIZE);
    }
    return filteredConcerts;
  }, [filteredConcerts, page, statusFilter]);

  const totalPages = useMemo(() => {
    if (statusFilter === 'all') {
      return Math.max(1, Math.ceil(filteredConcerts.length / PAGE_SIZE));
    }
    return meta?.totalPages || 1;
  }, [filteredConcerts, meta, statusFilter]);

  const formatEventDuration = (startStr: string, endStr?: string) => {
    if (!startStr) return '';
    const start = new Date(startStr);
    const optionsDate: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
    const optionsTime: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

    const startD = start.toLocaleDateString('vi-VN', optionsDate);
    const startT = start.toLocaleTimeString('vi-VN', optionsTime);

    if (!endStr) {
      return `${startD} | ${startT}`;
    }

    const end = new Date(endStr);
    if (start.toDateString() === end.toDateString()) {
      const endT = end.toLocaleTimeString('vi-VN', optionsTime);
      return `${startD} | ${startT} - ${endT}`;
    } else {
      const endD = end.toLocaleDateString('vi-VN', optionsDate);
      const endT = end.toLocaleTimeString('vi-VN', optionsTime);
      return `${startD} ${startT} - ${endD} ${endT}`;
    }
  };

  return (
    <>
      <section className="hero-section">
        <div className="container">
          <div className="hero-panel">
            <div className="hero-copy">
              <div className="eyebrow">Khám phá sự kiện</div>
              <h1 className="hero-title">Tìm show hợp gu, đặt vé thật nhanh.</h1>
              <p className="hero-subtitle">
                Lọc sự kiện theo gu nhạc, xem địa điểm và ngày diễn rõ ràng, rồi chọn vé chỉ trong vài bước.
              </p>
              <div className="hero-actions">
                <a href="#concerts" className="btn btn-primary">
                  <Ticket size={18} />
                  Xem sự kiện
                </a>
              </div>
            </div>
            <div className="hero-media">
              <img src={heroImage} alt="TicketBox event preview" />
            </div>
          </div>
        </div>
      </section>

      <div id="concerts" className="container">
        <header className="section-heading">
          <div>
            <h2>Sự kiện nổi bật</h2>
            <p>Tìm theo nghệ sĩ, địa điểm hoặc thể loại. Chọn show, chọn hạng vé và đi thẳng đến thanh toán.</p>
          </div>
        </header>

        {/* Tab & Filter bar wrapper */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '2px solid var(--border)', paddingBottom: '0.25rem' }}>
            {(['all', 'active', 'completed'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => handleStatusFilterChange(tab)}
                style={{
                  padding: '0.75rem 0.5rem',
                  border: 'none',
                  background: 'none',
                  borderBottom: statusFilter === tab ? '3px solid var(--primary)' : '3px solid transparent',
                  color: statusFilter === tab ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  marginBottom: '-2px'
                }}
              >
                {tab === 'all' ? 'Tất cả' : tab === 'active' ? 'Sắp diễn ra & Đang bán' : 'Đã diễn ra'}
              </button>
            ))}
          </div>

          <div className="filter-bar" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div className="input-with-icon" style={{ flex: 2, minWidth: '250px' }}>
              <Search size={18} />
              <input
                type="text"
                placeholder="Tìm theo nghệ sĩ, địa điểm, thể loại..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="form-control"
                aria-label="Tìm kiếm sự kiện"
              />
            </div>

            <select
              value={cityFilter}
              onChange={(e) => {
                setCityFilter(e.target.value);
                setPage(1);
              }}
              className="form-control"
              style={{ flex: 1, minWidth: '150px' }}
              aria-label="Lọc theo địa điểm"
            >
              <option value="">Tất cả địa điểm</option>
              <option value="Hồ Chí Minh">TP. Hồ Chí Minh</option>
              <option value="Hà Nội">Hà Nội</option>
              <option value="Đà Nẵng">Đà Nẵng</option>
              <option value="Khác">Khác</option>
            </select>

            <select
              value={selectedTag}
              onChange={(e) => handleTagChange(e.target.value)}
              className="form-control"
              style={{ flex: 1, minWidth: '150px' }}
              aria-label="Lọc theo thể loại"
            >
              <option value="">Tất cả thể loại</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>#{tag}</option>
              ))}
            </select>
          </div>
        </div>

        {loading && (
          <div className="flex-center" style={{ padding: '56px', flexDirection: 'column', gap: 16 }}>
            <div className="spinner" />
            <p style={{ color: 'var(--text-muted)' }}>Đang tải sự kiện...</p>
          </div>
        )}

        {error && (
          <div className="alert alert-danger">
            <div className="flex-between" style={{ gap: 12 }}>
              <span>{error}</span>
              <button className="btn btn-outline" onClick={fetchConcerts}>
                <RotateCcw size={16} />
                Thử lại
              </button>
            </div>
          </div>
        )}

        {!loading && !error && paginatedConcerts.length === 0 && (
          <div className="empty-state">
            <Ticket size={34} />
            <p>Chưa có sự kiện phù hợp.</p>
          </div>
        )}

        <div className="concert-grid grid-list">
          {paginatedConcerts.map((concert) => {
            const isPast = concert.endTime && new Date() > new Date(concert.endTime);
            const isCancelled = concert.status === 'cancelled';

            return (
              <article key={concert.id} className="card interactive-card concert-card">
                <div className="concert-poster">
                  {/* Status overlay badge */}
                  {isPast ? (
                    <span className="concert-status-badge ended">Đã kết thúc</span>
                  ) : isCancelled ? (
                    <span className="concert-status-badge cancelled">Đã hủy</span>
                  ) : null}

                  <img
                    src={concert.posterUrl || heroPreview}
                    alt={concert.title}
                    loading="lazy"
                  />
                </div>

                <div className="card-body">
                  {concert.tags && concert.tags.length > 0 && (
                    <div className="tag-row">
                      {concert.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="tag-pill">#{tag}</span>
                      ))}
                    </div>
                  )}
                  <h3 className="concert-title">{concert.title}</h3>
                  <div className="meta-list">
                    <p className="meta-item">
                      <CalendarDays size={14} />
                      {formatEventDuration(concert.startTime, concert.endTime)}
                    </p>
                    <p className="meta-item">
                      <MapPin size={14} />
                      {concert.location || '—'}
                    </p>
                  </div>
                  <div className="card-footer-action">
                    {isPast ? (
                      <Link to={`/concerts/${concert.id}`} className="btn btn-outline" style={{ width: '100%', color: 'var(--text-muted)' }}>
                        Đã kết thúc (Xem chi tiết)
                      </Link>
                    ) : isCancelled ? (
                      <button className="btn btn-outline" disabled style={{ width: '100%', cursor: 'not-allowed', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                        Đã hủy
                      </button>
                    ) : (
                      <Link to={`/concerts/${concert.id}`} className="btn btn-primary" style={{ width: '100%' }}>
                        <Ticket size={16} />
                        Chọn vé
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {!loading && !error && totalPages > 1 && (
          <div className="pagination-bar" aria-label="Phân trang sự kiện">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft size={16} />
              Trước
            </button>
            <span>
              Trang <strong>{page}</strong> / {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
            >
              Sau
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </>
  );
};
