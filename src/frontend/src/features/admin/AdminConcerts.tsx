import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import type { Concert } from '../concerts/ConcertList';
import { Plus, Edit2, Trash2, Users, FileText } from 'lucide-react';

interface TicketType {
  id: string;
  name: 'GA' | 'SVIP' | 'VIP' | 'CAT1' | 'CAT2';
  price: number;
  total_quantity: number;
  available_quantity: number;
  max_per_user: number;
}

export const AdminConcerts: React.FC = () => {
  const navigate = useNavigate();
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editingConcertId, setEditingConcertId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [svgStageMap, setSvgStageMap] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [posterPublicId, setPosterPublicId] = useState('');
  const [uploadingPoster, setUploadingPoster] = useState(false);

  // Ticket types management states (associated with currently edited concert)
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [newTicketName, setNewTicketName] = useState<'GA' | 'SVIP' | 'VIP' | 'CAT1' | 'CAT2'>('GA');
  const [newTicketPrice, setNewTicketPrice] = useState(500000);
  const [newTicketQty, setNewTicketQty] = useState(100);
  const [newTicketMaxUser, setNewTicketMaxUser] = useState(4);
  const [addingTicketType, setAddingTicketType] = useState(false);

  const fetchConcerts = async () => {
    setLoading(true);
    try {
      const response = await apiClient.request<{ data: { concerts: Concert[] } }>('/concerts');
      setConcerts(response?.data?.concerts || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load concerts');
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
    setTagsInput('');
    setSvgStageMap('');
    setPosterUrl('');
    setPosterPublicId('');
    setTicketTypes([]);
    setError('');
    setSuccess('');
    setShowForm(true);
  };

  const handleOpenEdit = async (concert: Concert) => {
    setEditingConcertId(concert.id);
    setTitle(concert.title);
    setDescription(concert.description);
    setLocation(concert.location);
    // Parse times to datetime-local compatible string
    setStartTime(new Date(concert.start_time).toISOString().substring(0, 16));
    setEndTime(new Date(new Date(concert.start_time).getTime() + 3 * 3600000).toISOString().substring(0, 16));
    setTagsInput((concert.tags || []).join(', '));
    setPosterUrl(concert.posterUrl || '');
    setError('');
    setSuccess('');
    setShowForm(true);

    try {
      const [ticketsRes, svgRes] = await Promise.all([
        apiClient.request<{ data: TicketType[] }>(`/concerts/${concert.id}/ticket-types`),
        apiClient.request<{ svgStageMap?: string }>(`/concerts/${concert.id}/stagemap`).catch(() => ({ svgStageMap: '' })),
      ]);
      setTicketTypes(ticketsRes.data);
      setSvgStageMap(svgRes.svgStageMap || '');
    } catch (err: any) {
      setError('Could not load ticket types or stage map: ' + err.message);
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
      setSuccess('Poster uploaded successfully.');
    } catch (err: any) {
      setError('Poster upload failed: ' + err.message);
    } finally {
      setUploadingPoster(false);
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
      tags,
      svgStageMap: svgStageMap || undefined,
      posterUrl: posterUrl || undefined,
      posterPublicId: posterPublicId || undefined,
    };

    try {
      if (editingConcertId) {
        await apiClient.request(`/concerts/${editingConcertId}`, {
          method: 'PATCH',
          body: JSON.stringify(bodyData),
        });
        setSuccess('Concert updated successfully.');
      } else {
        await apiClient.request('/concerts', {
          method: 'POST',
          body: JSON.stringify(bodyData),
        });
        setSuccess('Concert created successfully.');
      }
      setShowForm(false);
      fetchConcerts();
    } catch (err: any) {
      setError(err.message || 'Failed to save concert');
    }
  };

  const handleDeleteConcert = async (concertId: string) => {
    if (!window.confirm('Are you sure you want to delete this concert?')) return;
    setError('');
    setSuccess('');

    try {
      await apiClient.request(`/concerts/${concertId}`, {
        method: 'DELETE',
      });
      setSuccess('Concert deleted successfully.');
      fetchConcerts();
    } catch (err: any) {
      setError(
        err.message ||
          'Failed to delete concert. If bookings exist, please consider setting its status to cancelled.'
      );
    }
  };

  // Ticket Types functions
  const handleAddTicketType = async () => {
    if (!editingConcertId) return;
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
      setSuccess('Ticket type added successfully.');
      // Refresh ticket types list
      const ticketsRes = await apiClient.request<{ data: TicketType[] }>(`/concerts/${editingConcertId}/ticket-types`);
      setTicketTypes(ticketsRes.data);
    } catch (err: any) {
      setError(err.message || 'Failed to add ticket type');
    } finally {
      setAddingTicketType(false);
    }
  };

  const handleDeleteTicketType = async (typeId: string) => {
    if (!window.confirm('Delete this ticket type?')) return;
    setError('');
    try {
      await apiClient.request(`/ticket-types/${typeId}`, {
        method: 'DELETE',
      });
      setSuccess('Ticket type deleted.');
      setTicketTypes(ticketTypes.filter((t) => t.id !== typeId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete ticket type');
    }
  };

  return (
    <div className="container">
      <header className="section-heading">
        <div>
          <h1>Concerts</h1>
          <p>Manage your events, ticket zones, and uploads.</p>
        </div>
        {!showForm && (
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={18} style={{ marginRight: '0.5rem' }} /> Create Concert
          </button>
        )}
      </header>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showForm ? (
        <div className="card" style={{ marginBottom: '3rem' }}>
          <div className="card-body">
            <h2 style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>
              {editingConcertId ? 'Edit Concert' : 'Create New Concert'}
            </h2>
            
            <form onSubmit={handleSubmitConcert} className="admin-form-grid">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="form-group">
                  <label htmlFor="concert-title" className="form-label">Concert Title</label>
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
                  <label htmlFor="concert-location" className="form-label">Location / Venue</label>
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
                    <label htmlFor="concert-start-time" className="form-label">Start Time</label>
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
                    <label htmlFor="concert-end-time" className="form-label">End Time</label>
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
                  <label htmlFor="concert-tags" className="form-label">Tags (separated by comma)</label>
                  <input
                    id="concert-tags"
                    type="text"
                    placeholder="e.g. pop, ballad, live"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    className="form-control"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="concert-poster" className="form-label">Upload Poster Image</label>
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
                      alt="Poster Preview"
                      style={{ width: '100px', height: '120px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', marginTop: '0.5rem' }}
                    />
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="form-group">
                  <label htmlFor="concert-description" className="form-label">Description</label>
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
                  <label htmlFor="concert-svg-map" className="form-label">SVG Seating Map Content (XML String)</label>
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
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={uploadingPoster}>
                    Save Concert
                  </button>
                </div>
              </div>
            </form>

            {/* Ticket types section (Only visible when editing an existing concert) */}
            {editingConcertId && (
              <div style={{ marginTop: '3.5rem', borderTop: '1px solid var(--border)', paddingTop: '2.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Manage Ticket Types</h3>
                
                {/* Add ticket type mini-form */}
                <div className="ticket-mini-form">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Type Name</label>
                    <select className="form-control" value={newTicketName} onChange={(e: any) => setNewTicketName(e.target.value)}>
                      <option value="GA">GA</option>
                      <option value="SVIP">SVIP</option>
                      <option value="VIP">VIP</option>
                      <option value="CAT1">CAT1</option>
                      <option value="CAT2">CAT2</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Price (VND)</label>
                    <input type="number" className="form-control" value={newTicketPrice} onChange={(e) => setNewTicketPrice(Number(e.target.value))} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Quantity</label>
                    <input type="number" className="form-control" value={newTicketQty} onChange={(e) => setNewTicketQty(Number(e.target.value))} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Max Per User</label>
                    <input type="number" className="form-control" value={newTicketMaxUser} onChange={(e) => setNewTicketMaxUser(Number(e.target.value))} />
                  </div>
                  <button className="btn btn-primary" onClick={handleAddTicketType} disabled={addingTicketType}>
                    Add
                  </button>
                </div>

                {/* List of ticket types */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {ticketTypes.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>No ticket types configured yet.</p>
                  ) : (
                    ticketTypes.map((type) => (
                      <div key={type.id} className="ticket-row">
                        <div>
                          <strong style={{ fontSize: '1.1rem', color: 'var(--text-strong)' }}>{type.name}</strong>
                          <span style={{ marginLeft: '1.5rem', color: 'var(--text-muted)' }}>
                            {type.price.toLocaleString()} VND
                          </span>
                          <span style={{ marginLeft: '1.5rem', color: 'var(--text-muted)' }}>
                            Qty: {type.available_quantity} / {type.total_quantity}
                          </span>
                        </div>
                        <button className="btn" style={{ padding: '0.5rem', color: 'var(--danger)' }} onClick={() => handleDeleteTicketType(type.id)}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          {loading ? (
            <div className="flex-center" style={{ padding: '4rem' }}>
              <div className="spinner" />
            </div>
          ) : concerts.length === 0 ? (
            <div className="empty-state">
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '1.1rem' }}>No concerts found.</p>
              <button className="btn btn-primary" onClick={handleOpenCreate}>
                Create Your First Concert
              </button>
            </div>
          ) : (
            <div className="grid-list">
              {concerts.map((concert) => (
                <div key={concert.id} className="card interactive-card concert-card">
                  <div className="concert-poster">
                    <img
                      src={concert.posterUrl || 'https://picsum.photos/seed/' + encodeURIComponent(concert.title) + '/600/400'}
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
                        <Users size={16} /> Guests
                      </Link>
                      <Link to={`/admin/concerts/${concert.id}/bio`} className="btn btn-outline" style={{ gap: '0.5rem', padding: '0.5rem', fontSize: '0.85rem' }}>
                        <FileText size={16} /> AI Bio
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
                        <button className="btn btn-outline" style={{ padding: '0.5rem' }} onClick={() => handleOpenEdit(concert)}>
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
