import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import type { Concert } from '../concerts/ConcertList';
import { Plus, Edit2, Trash2, Users, FileText } from 'lucide-react';
import heroPreview from '../../assets/hero.png';

interface TicketType {
  id: string;
  name: string;
  price: number;
  totalQuantity: number;
  availableQuantity: number;
  maxPerUser: number;
}

type TicketTypeName = string;
type ConcertStatus = 'draft' | 'active' | 'cancelled';

interface FormTicketType {
  id?: string;
  clientId?: string;
  name: string;
  price: number;
  totalQuantity: number;
  availableQuantity: number;
  maxPerUser: number;
}

export const AdminConcerts: React.FC = () => {
  const navigate = useNavigate();
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ConcertStatus>('all');

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editingConcertId, setEditingConcertId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [status, setStatus] = useState<ConcertStatus>('active');
  const [tagsInput, setTagsInput] = useState('');
  const [svgStageMap, setSvgStageMap] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [posterPublicId, setPosterPublicId] = useState('');
  const [uploadingPoster, setUploadingPoster] = useState(false);

  // Ticket types management states (associated with currently edited concert)
  const [ticketTypes, setTicketTypes] = useState<FormTicketType[]>([]);
  const [newTicketName, setNewTicketName] = useState<TicketTypeName>('GA');
  const [newTicketPrice, setNewTicketPrice] = useState(500000);
  const [newTicketQty, setNewTicketQty] = useState(100);
  const [newTicketMaxUser, setNewTicketMaxUser] = useState(4);
  const [addingTicketType, setAddingTicketType] = useState(false);
  const [editingTicketTypeId, setEditingTicketTypeId] = useState<string | null>(null);
  const [editTicketName, setEditTicketName] = useState<TicketTypeName>('GA');
  const [editTicketPrice, setEditTicketPrice] = useState(0);
  const [editTicketQty, setEditTicketQty] = useState(0);
  const [editTicketMaxUser, setEditTicketMaxUser] = useState(1);
  const [updatingTicketType, setUpdatingTicketType] = useState(false);

  const filteredConcerts = useMemo(() => {
    if (statusFilter === 'all') return concerts;
    return concerts.filter((concert) => concert.status === statusFilter);
  }, [concerts, statusFilter]);

  const fetchConcerts = async () => {
    setLoading(true);
    try {
      const response = await apiClient.request<{ concerts: Concert[] }>('/concerts');
      setConcerts(response?.concerts || []);
    } catch (err: any) {
      setError(err.message || 'Không tải được danh sách sự kiện');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConcerts();
  }, []);

  const handleOpenCreate = () => {
    setEditingConcertId(null);
    setTitle('');
    setDescription('');
    setLocation('');
    setStartTime('');
    setEndTime('');
    setStatus('active');
    setTagsInput('');
    setSvgStageMap('');
    setPosterUrl('');
    setPosterPublicId('');
    setTicketTypes([]);
    setEditingTicketTypeId(null);
    setError('');
    setSuccess('');
    setShowForm(true);
  };

  const toLocalISOString = (dateInput: Date | string) => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    const tzoffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzoffset).toISOString().substring(0, 16);
  };

  const handleOpenEdit = async (concert: Concert) => {
    setEditingConcertId(concert.id);
    setTitle(concert.title);
    setDescription(concert.description);
    setLocation(concert.location);
    // Parse times to datetime-local compatible string using local timezone
    setStartTime(toLocalISOString(concert.startTime));
    setEndTime(toLocalISOString(concert.endTime || new Date(new Date(concert.startTime).getTime() + 3 * 3600000)));
    setStatus(concert.status);
    setTagsInput((concert.tags || []).join(', '));
    setPosterUrl(concert.posterUrl || '');
    setError('');
    setSuccess('');
    setShowForm(true);
    setEditingTicketTypeId(null);

    try {
      const [ticketsRes, svgRes] = await Promise.all([
        apiClient.request<TicketType[]>(`/concerts/${concert.id}/ticket-types`),
        apiClient.request<{ svgStageMap?: string }>(`/concerts/${concert.id}/stagemap`).catch(() => ({ svgStageMap: '' })),
      ]);
      setTicketTypes(ticketsRes);
      setSvgStageMap(svgRes.svgStageMap || '');
    } catch (err: any) {
      setError('Không tải được hạng vé hoặc sơ đồ sân khấu: ' + err.message);
    }
  };

  const handlePosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPoster(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiClient.request<{ url: string; publicId: string }>('/concerts/upload-poster', {
        method: 'POST',
        body: formData,
      });
      setPosterUrl(res.url);
      setPosterPublicId(res.publicId);
      setSuccess('Đã tải poster lên.');
    } catch (err: any) {
      setError('Tải poster thất bại: ' + err.message);
    } finally {
      setUploadingPoster(false);
    }
  };

  const handleSvgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setSvgStageMap(text);
      setSuccess('Đã đọc file SVG.');
    } catch (err: any) {
      setError('Không đọc được file SVG: ' + err.message);
    }
  };

  const handleSubmitConcert = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const bodyData = {
      title,
      description,
      location,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      status,
      tags,
      svgStageMap: svgStageMap || undefined,
      posterUrl: posterUrl || undefined,
      posterPublicId: posterPublicId || undefined,
      ticketTypes: editingConcertId
        ? undefined
        : ticketTypes.map((type) => ({
            name: type.name,
            price: type.price,
            totalQuantity: type.totalQuantity,
            maxPerUser: type.maxPerUser,
          })),
    };

    try {
      if (editingConcertId) {
        await apiClient.request(`/concerts/${editingConcertId}`, {
          method: 'PATCH',
          body: JSON.stringify(bodyData),
        });
        setSuccess('Đã cập nhật concert.');
      } else {
        await apiClient.request('/concerts', {
          method: 'POST',
          body: JSON.stringify(bodyData),
        });
        setSuccess('Đã tạo concert.');
      }
      setShowForm(false);
      fetchConcerts();
    } catch (err: any) {
      setError(err.message || 'Không lưu được concert');
    }
  };

  const handleDeleteConcert = async (concertId: string) => {
    if (!window.confirm('Bạn chắc chắn muốn xóa concert này?')) return;
    setError('');
    setSuccess('');

    try {
      await apiClient.request(`/concerts/${concertId}`, {
        method: 'DELETE',
      });
      setSuccess('Đã xóa concert.');
      fetchConcerts();
    } catch (err: any) {
      setError(
        err.message ||
          'Không thể xóa concert. Nếu đã có booking, hãy cân nhắc chuyển trạng thái sang cancelled.'
      );
    }
  };

  // Ticket Types functions
  const handleAddTicketType = async () => {
    const nextTicketType: FormTicketType = {
      clientId: crypto.randomUUID(),
      name: newTicketName,
      price: newTicketPrice,
      totalQuantity: newTicketQty,
      availableQuantity: newTicketQty,
      maxPerUser: newTicketMaxUser,
    };

    if (!editingConcertId) {
      setTicketTypes((current) => [...current, nextTicketType]);
      setSuccess('Đã thêm hạng vé vào concert mới.');
      return;
    }

    setAddingTicketType(true);
    setError('');
    try {
      await apiClient.request(`/concerts/${editingConcertId}/ticket-types`, {
        method: 'POST',
        body: JSON.stringify({
          name: newTicketName,
          price: newTicketPrice,
          totalQuantity: newTicketQty,
          maxPerUser: newTicketMaxUser,
        }),
      });
      setSuccess('Đã thêm hạng vé.');
      // Refresh ticket types list
      const ticketsRes = await apiClient.request<TicketType[]>(`/concerts/${editingConcertId}/ticket-types`);
      setTicketTypes(ticketsRes);
    } catch (err: any) {
      setError(err.message || 'Không thêm được hạng vé');
    } finally {
      setAddingTicketType(false);
    }
  };

  const handleDeleteTicketType = async (type: FormTicketType) => {
    if (!window.confirm('Xóa hạng vé này?')) return;
    setError('');

    if (!editingConcertId || !type.id) {
      setTicketTypes(ticketTypes.filter((t) => t.clientId !== type.clientId));
      return;
    }

    try {
      await apiClient.request(`/ticket-types/${type.id}`, {
        method: 'DELETE',
      });
      setSuccess('Đã xóa hạng vé.');
      setTicketTypes(ticketTypes.filter((t) => t.id !== type.id));
    } catch (err: any) {
      setError(err.message || 'Không xóa được hạng vé');
    }
  };

  const handleStartEditTicketType = (type: FormTicketType) => {
    if (!type.id) return;
    setEditingTicketTypeId(type.id);
    setEditTicketName(type.name);
    setEditTicketPrice(type.price);
    setEditTicketQty(type.totalQuantity);
    setEditTicketMaxUser(type.maxPerUser);
    setError('');
    setSuccess('');
  };

  const handleCancelEditTicketType = () => {
    setEditingTicketTypeId(null);
    setError('');
  };

  const handleUpdateTicketType = async () => {
    if (!editingTicketTypeId) return;
    setUpdatingTicketType(true);
    setError('');
    setSuccess('');

    const body = {
      name: editTicketName,
      price: editTicketPrice,
      totalQuantity: editTicketQty,
      maxPerUser: editTicketMaxUser,
    };

    try {
      await apiClient.request(`/ticket-types/${editingTicketTypeId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setTicketTypes((current) =>
        current.map((type) =>
          type.id === editingTicketTypeId
            ? {
                ...type,
                ...body,
                availableQuantity:
                  editTicketQty < type.availableQuantity ? editTicketQty : type.availableQuantity,
              }
            : type
        )
      );
      setEditingTicketTypeId(null);
      setSuccess('Đã cập nhật hạng vé.');
    } catch (err: any) {
      setError(err.message || 'Không cập nhật được hạng vé');
    } finally {
      setUpdatingTicketType(false);
    }
  };

  return (
    <div className="container">
      <header className="section-heading">
        <div>
          <h1>Concerts</h1>
          <p>Quản lý sự kiện, hạng vé, poster và khách mời trong một nơi.</p>
        </div>
        {!showForm && (
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={18} style={{ marginRight: '0.5rem' }} /> Tạo concert
          </button>
        )}
      </header>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showForm ? (
        <div className="card" style={{ marginBottom: '3rem' }}>
          <div className="card-body">
            <h2 style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>
              {editingConcertId ? 'Chỉnh sửa concert' : 'Tạo concert mới'}
            </h2>
            
            <form onSubmit={handleSubmitConcert} className="admin-form-grid">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="form-group">
                  <label htmlFor="concert-title" className="form-label">Tên concert</label>
                  <input
                    id="concert-title"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="form-control"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="concert-location" className="form-label">Địa điểm</label>
                  <input
                    id="concert-location"
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="form-control"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  <div className="form-group">
                    <label htmlFor="concert-start-time" className="form-label">Thời gian bắt đầu</label>
                    <input
                      id="concert-start-time"
                      type="datetime-local"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="concert-end-time" className="form-label">Thời gian kết thúc</label>
                    <input
                      id="concert-end-time"
                      type="datetime-local"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="form-control"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="concert-tags" className="form-label">Thể loại (cách nhau bằng dấu phẩy)</label>
                  <input
                    id="concert-tags"
                    type="text"
                    placeholder="pop, ballad, live"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    className="form-control"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="concert-status" className="form-label">Trạng thái</label>
                  <select
                    id="concert-status"
                    className="form-control"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ConcertStatus)}
                  >
                    <option value="active">Đang bán</option>
                    <option value="draft">Bản nháp</option>
                    <option value="cancelled">Đã hủy</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="concert-poster" className="form-label">Poster sự kiện</label>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <input
                      id="concert-poster"
                      type="file"
                      accept="image/*"
                      onChange={handlePosterUpload}
                      className="form-control"
                      style={{ flex: 1 }}
                    />
                    {uploadingPoster && <div className="spinner" style={{ width: '24px', height: '24px', borderWidth: '3px' }} />}
                  </div>
                  {posterUrl && (
                    <img
                      src={posterUrl}
                      alt="Xem trước poster"
                      style={{ width: '100px', height: '120px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', marginTop: '0.5rem' }}
                    />
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="form-group">
                  <label htmlFor="concert-description" className="form-label">Mô tả</label>
                  <textarea
                    id="concert-description"
                    rows={4}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="form-control"
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="concert-svg-map" className="form-label">Sơ đồ ghế SVG</label>
                  <input
                    id="concert-svg-file"
                    type="file"
                    accept=".svg,image/svg+xml"
                    onChange={handleSvgUpload}
                    className="form-control"
                    aria-label="Tải file SVG"
                    style={{ marginBottom: '0.75rem' }}
                  />
                  <textarea
                    id="concert-svg-map"
                    rows={6}
                    placeholder="<svg>...</svg>"
                    value={svgStageMap}
                    onChange={(e) => setSvgStageMap(e.target.value)}
                    className="form-control"
                    style={{ fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: 'auto', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
                    Hủy
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={uploadingPoster}>
                    Lưu concert
                  </button>
                </div>
              </div>
            </form>

            {/* Ticket types section */}
              <div style={{ marginTop: '3.5rem', borderTop: '1px solid var(--border)', paddingTop: '2.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Quản lý hạng vé</h3>
                
                {/* Add ticket type mini-form */}
                <div className="ticket-mini-form">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="ticket-type-name" className="form-label">Hạng vé</label>
                    <input
                      id="ticket-type-name"
                      type="text"
                      className="form-control"
                      placeholder="VD: VIP Stand, GA..."
                      value={newTicketName}
                      onChange={(e) => setNewTicketName(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="ticket-type-price" className="form-label">Giá (VND)</label>
                    <input id="ticket-type-price" type="number" className="form-control" value={newTicketPrice} onChange={(e) => setNewTicketPrice(Number(e.target.value))} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="ticket-type-qty" className="form-label">Số lượng</label>
                    <input id="ticket-type-qty" type="number" className="form-control" value={newTicketQty} onChange={(e) => setNewTicketQty(Number(e.target.value))} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="ticket-type-max" className="form-label">Tối đa/người</label>
                    <input id="ticket-type-max" type="number" className="form-control" value={newTicketMaxUser} onChange={(e) => setNewTicketMaxUser(Number(e.target.value))} />
                  </div>
                  <button className="btn btn-primary" onClick={handleAddTicketType} disabled={addingTicketType}>
                    Thêm
                  </button>
                </div>

                {/* List of ticket types */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {ticketTypes.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>Chưa có hạng vé nào.</p>
                  ) : (
                    ticketTypes.map((type) => (
                      <div key={type.id || type.clientId} className="ticket-row">
                        {editingTicketTypeId === type.id ? (
                          <div className="ticket-mini-form" style={{ flex: 1, marginBottom: 0 }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label htmlFor="edit-ticket-name" className="form-label">Hạng vé đang sửa</label>
                              <input
                                id="edit-ticket-name"
                                type="text"
                                className="form-control"
                                placeholder="VD: VIP Stand, GA..."
                                value={editTicketName}
                                onChange={(e) => setEditTicketName(e.target.value)}
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label htmlFor="edit-ticket-price" className="form-label">Giá hạng vé đang sửa</label>
                              <input
                                id="edit-ticket-price"
                                type="number"
                                className="form-control"
                                value={editTicketPrice}
                                onChange={(e) => setEditTicketPrice(Number(e.target.value))}
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label htmlFor="edit-ticket-qty" className="form-label">Số lượng hạng vé đang sửa</label>
                              <input
                                id="edit-ticket-qty"
                                type="number"
                                className="form-control"
                                value={editTicketQty}
                                onChange={(e) => setEditTicketQty(Number(e.target.value))}
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label htmlFor="edit-ticket-max" className="form-label">Tối đa mỗi người hạng vé đang sửa</label>
                              <input
                                id="edit-ticket-max"
                                type="number"
                                className="form-control"
                                value={editTicketMaxUser}
                                onChange={(e) => setEditTicketMaxUser(Number(e.target.value))}
                              />
                            </div>
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={handleUpdateTicketType}
                              disabled={updatingTicketType}
                            >
                              Lưu hạng vé
                            </button>
                            <button type="button" className="btn btn-outline" onClick={handleCancelEditTicketType}>
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <>
                            <div>
                              <strong style={{ fontSize: '1.1rem', color: 'var(--text-strong)' }}>{type.name}</strong>
                              <span style={{ marginLeft: '1.5rem', color: 'var(--text-muted)' }}>
                                {type.price.toLocaleString()} VND
                              </span>
                              <span style={{ marginLeft: '1.5rem', color: 'var(--text-muted)' }}>
                                Còn: {type.availableQuantity} / {type.totalQuantity}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              {type.id && (
                                <button
                                  type="button"
                                  className="btn btn-outline"
                                  style={{ padding: '0.5rem' }}
                                  onClick={() => handleStartEditTicketType(type)}
                                  aria-label={`Sửa hạng vé ${type.name}`}
                                >
                                  <Edit2 size={18} />
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn"
                                style={{ padding: '0.5rem', color: 'var(--danger)' }}
                                onClick={() => handleDeleteTicketType(type)}
                                aria-label={`Xóa hạng vé ${type.name}`}
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="filter-bar" style={{ marginBottom: '1.5rem' }}>
            <div className="form-group" style={{ marginBottom: 0, maxWidth: 260 }}>
              <label htmlFor="concert-status-filter" className="form-label">Lọc trạng thái</label>
              <select
                id="concert-status-filter"
                className="form-control"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | ConcertStatus)}
              >
                <option value="all">Tất cả</option>
                <option value="active">Đang bán</option>
                <option value="draft">Bản nháp</option>
                <option value="cancelled">Đã hủy</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex-center" style={{ padding: '4rem' }}>
              <div className="spinner" />
            </div>
          ) : concerts.length === 0 ? (
            <div className="empty-state">
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '1.1rem' }}>Chưa có concert nào.</p>
              <button className="btn btn-primary" onClick={handleOpenCreate}>
                Tạo concert đầu tiên
              </button>
            </div>
          ) : filteredConcerts.length === 0 ? (
            <div className="empty-state">
              <p style={{ color: 'var(--text-muted)', marginBottom: 0, fontSize: '1.1rem' }}>
                Không có concert phù hợp với trạng thái đã chọn.
              </p>
            </div>
          ) : (
            <div className="grid-list">
              {filteredConcerts.map((concert) => (
                <div key={concert.id} className="card interactive-card concert-card">
                  <div className="concert-poster">
                    <img
                      src={concert.posterUrl || heroPreview}
                      alt={concert.title}
                      loading="lazy"
                    />
                  </div>
                  <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{concert.title}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                      {concert.location}
                    </p>
                    
                    {/* Operation links */}
                    <div className="admin-card-actions">
                      <Link to={`/admin/concerts/${concert.id}/guests`} className="btn btn-outline" style={{ gap: '0.5rem', padding: '0.5rem', fontSize: '0.85rem' }}>
                        <Users size={16} /> Khách mời
                      </Link>
                      <Link to={`/admin/concerts/${concert.id}/bio`} className="btn btn-outline" style={{ gap: '0.5rem', padding: '0.5rem', fontSize: '0.85rem' }}>
                        <FileText size={16} /> Hồ sơ AI
                      </Link>
                    </div>

                    <div className="admin-card-toolbar">
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          padding: '0.25rem 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          textTransform: 'uppercase',
                          backgroundColor:
                            concert.status === 'active'
                              ? 'var(--primary-soft)'
                              : concert.status === 'cancelled'
                              ? '#fee2e2'
                              : 'var(--surface-alt)',
                          color:
                            concert.status === 'active'
                              ? 'var(--primary)'
                              : concert.status === 'cancelled'
                              ? 'var(--danger)'
                              : 'var(--text-muted)',
                        }}
                      >
                        {concert.status}
                      </span>
                      
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '0.5rem' }}
                          onClick={() => handleOpenEdit(concert)}
                          aria-label={`Chỉnh sửa concert ${concert.title}`}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button className="btn btn-outline" style={{ padding: '0.5rem', color: 'var(--danger)' }} onClick={() => handleDeleteConcert(concert.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
