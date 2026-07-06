import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, RotateCcw, Search, Sparkles, Ticket } from 'lucide-react';
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
  status: 'draft' | 'active' | 'cancelled';
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
  const [page, setPage] = useState(1);

  const fetchConcerts = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        status: 'active',
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (search.trim()) params.set('search', search.trim());
      if (selectedTag) params.set('tag', selectedTag);

      const response = await apiClient.request<{ concerts: Concert[]; meta?: ConcertMeta }>(
        `/concerts?${params.toString()}`
      );
      setConcerts(response.concerts || []);
      setMeta(response.meta || null);
    } catch (err: any) {
      setError(err.message || 'Không tải được danh sách sự kiện');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConcerts();
  }, [page, search, selectedTag]);

  const allTags = useMemo(() => Array.from(new Set(concerts.flatMap((c) => c.tags || []))), [concerts]);
  const featuredConcert = concerts[0];
  const heroImage = featuredConcert?.posterUrl || heroPreview;
  const totalPages = meta?.totalPages || 1;

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

        <div className="filter-bar">
          <div className="input-with-icon">
            <Search size={18} />
            <input
              type="text"
              placeholder="Tìm theo nghệ sĩ, địa điểm, thể loại..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="form-control"
              aria-label="Tìm kiếm sự kiện"
            />
          </div>

          <select
            value={selectedTag}
            onChange={(e) => {
              setSelectedTag(e.target.value);
              setPage(1);
            }}
            className="form-control"
            aria-label="Lọc theo thể loại"
          >
            <option value="">Tất cả thể loại</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>#{tag}</option>
            ))}
          </select>
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

        {!loading && !error && concerts.length === 0 && (
          <div className="empty-state">
            <Ticket size={34} />
            <p>Chưa có sự kiện phù hợp.</p>
          </div>
        )}

        <div className="concert-grid grid-list">
          {concerts.map((concert) => (
            <article key={concert.id} className="card interactive-card concert-card">
              <div className="concert-poster">
                {concert.endTime && new Date() > new Date(concert.endTime) ? (
                  <span className="concert-status-badge ended">Đã kết thúc</span>
                ) : concert.status === 'cancelled' ? (
                  <span className="concert-status-badge ended">Đã hủy</span>
                ) : null}
                <img
                  src={concert.posterUrl || heroPreview}
                  alt={concert.title}
                  loading="lazy"
                />
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div className="tag-row">
                  {concert.tags?.slice(0, 3).map((tag) => (
                    <span key={tag} className="tag-pill">#{tag}</span>
                  ))}
                </div>
                <h3 className="concert-title">{concert.title}</h3>
                <div className="meta-list">
                  <p className="meta-item">
                    <MapPin size={16} />
                    {concert.location}
                  </p>
                  <p className="meta-item">
                    <CalendarDays size={16} />
                    {new Date(concert.startTime).toLocaleString('vi-VN')}
                    {concert.endTime && ` - ${new Date(concert.endTime).toLocaleString('vi-VN')}`}
                  </p>
                </div>
                <div className="card-footer-action">
                  {concert.endTime && new Date() > new Date(concert.endTime) ? (
                    <button className="btn" disabled style={{ width: '100%', cursor: 'not-allowed' }}>
                      Đã kết thúc
                    </button>
                  ) : concert.status === 'cancelled' ? (
                    <button className="btn btn-outline" disabled style={{ width: '100%', cursor: 'not-allowed', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                      Đã hủy
                    </button>
                  ) : (
                    <Link to={`/concerts/${concert.id}`} className="btn btn-primary" style={{ width: '100%' }}>
                      Chọn vé
                    </Link>
                  )}
                </div>
              </div>
            </article>
          ))}
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
