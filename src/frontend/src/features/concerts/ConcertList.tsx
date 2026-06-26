import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { CalendarDays, MapPin, Search, Sparkles, Ticket } from 'lucide-react';
import heroPreview from '../../assets/hero.png';

export interface Concert {
  id: string;
  title: string;
  description: string;
  location: string;
  posterUrl: string;
  start_time: string;
  tags: string[];
  status: 'draft' | 'active' | 'cancelled';
}

export const ConcertList: React.FC = () => {
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('');

  const fetchConcerts = async () => {
    setLoading(true);
    setError('');
    try {
      let path = '/concerts?status=active';
      if (search) path += `&search=${encodeURIComponent(search)}`;
      if (selectedTag) path += `&tag=${encodeURIComponent(selectedTag)}`;
      
      const response = await apiClient.request<{ data: { concerts: Concert[] } }>(path);
      setConcerts(response.data.concerts || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load concerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConcerts();
  }, [search, selectedTag]);

  const allTags = Array.from(new Set(concerts.flatMap((c) => c.tags || [])));
  const featuredConcert = concerts[0];
  const heroImage = featuredConcert?.posterUrl || heroPreview;

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
            <div className="eyebrow" style={{ color: 'var(--primary)', marginBottom: 8 }}>
              <Sparkles size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Đang mở bán
            </div>
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
              onChange={(e) => setSearch(e.target.value)}
              className="form-control"
              aria-label="Search concerts"
            />
          </div>

          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="form-control"
            aria-label="Filter by tag"
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

        {error && <div className="alert alert-danger">{error}</div>}

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
                    {new Date(concert.start_time).toLocaleString()}
                  </p>
                </div>
                <div className="card-footer-action">
                  <Link to={`/concerts/${concert.id}`} className="btn btn-primary" style={{ width: '100%' }}>
                    Chọn vé
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
};
