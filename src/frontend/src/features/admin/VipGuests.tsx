import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useSocket } from '../socket/SocketContext';
import { ArrowLeft, Upload, Search, FileText, CheckCircle, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

interface VipGuest {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  affiliateCompany: string | null;
  status: 'reserved' | 'active' | 'used';
  checkinStatus: 'not_checked_in' | 'checked_in';
}

interface VipGuestImport {
  id: string;
  concertId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRows: number;
  importedRows: number;
  errorLogs: Array<{ row: number; email?: string; reason: string }> | null;
  createdAt: string;
  updatedAt: string;
}

export const VipGuests: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { socket } = useSocket();

  // List States
  const [guests, setGuests] = useState<VipGuest[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Import States
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importJob, setImportJob] = useState<VipGuestImport | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchGuests = async (currentPage = page, currentSearch = search) => {
    if (!id) return;
    setLoadingList(true);
    try {
      const query = `?page=${currentPage}&limit=10${currentSearch ? `&search=${encodeURIComponent(currentSearch)}` : ''}`;
      const res = await apiClient.request<{
        data: VipGuest[];
        meta: { totalPages: number; totalItems: number };
      }>(`/concerts/${id}/guests${query}`);
      setGuests(res.data);
      setTotalPages(res.meta.totalPages);
      setTotalItems(res.meta.totalItems);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch guest list');
    } finally {
      setLoadingList(false);
    }
  };

  const fetchJobStatus = async (jobId: string) => {
    if (!id) return;
    try {
      const job = await apiClient.request<VipGuestImport>(`/concerts/${id}/guests/imports/${jobId}`);
      setImportJob(job);
      if (job.status === 'completed' || job.status === 'failed') {
        if (job.status === 'completed') {
          setSuccess('VIP Guest list import completed.');
          fetchGuests(1);
        } else {
          setError('VIP Guest list import failed.');
        }
      }
    } catch (err: any) {
      console.error('Failed to poll job status:', err);
    }
  };

  useEffect(() => {
    fetchGuests(1);
  }, [id]);

  const importJobRef = React.useRef(importJob);
  useEffect(() => {
    importJobRef.current = importJob;
  }, [importJob]);

  // Socket notification listener
  useEffect(() => {
    if (!socket || !id) return;

    const handleImportStatus = (job: any) => {
      const currentJob = importJobRef.current;
      if (currentJob && job.id === currentJob.id) {
        setImportJob(job);
        if (job.status === 'completed') {
          setSuccess('VIP Guest list import completed.');
          fetchGuests(1);
        } else if (job.status === 'failed') {
          setError('VIP Guest list import failed.');
        }
      }
    };

    socket.on('vip_import_status', handleImportStatus);

    return () => {
      socket.off('vip_import_status', handleImportStatus);
    };
  }, [socket, id]);

  // Fallback Polling
  useEffect(() => {
    if (!importJob) return;
    if (importJob.status === 'completed' || importJob.status === 'failed') return;

    const interval = setInterval(() => {
      fetchJobStatus(importJob.id);
    }, 3000);

    return () => clearInterval(interval);
  }, [importJob]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCsvFile(e.target.files[0]);
      setError('');
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !csvFile) return;

    setUploading(true);
    setError('');
    setSuccess('');
    setImportJob(null);

    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      const res = await apiClient.request<{ jobId: string; status: VipGuestImport['status'] }>(
        `/concerts/${id}/guests/import`,
        {
          method: 'POST',
          body: formData,
        }
      );
      setSuccess('CSV uploaded. VIP Guest list import is processing.');
      setCsvFile(null);

      setImportJob({
        id: res.jobId,
        concertId: id,
        status: res.status,
        totalRows: 0,
        importedRows: 0,
        errorLogs: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      setError(err.message || 'Failed to start import job');
    } finally {
      setUploading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchGuests(1, search);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      fetchGuests(newPage, search);
    }
  };

  const getProgressPercentage = () => {
    if (!importJob || !importJob.totalRows || importJob.totalRows === 0) return 0;
    return Math.min(100, Math.round(((importJob.importedRows || 0) / importJob.totalRows) * 100));
  };

  return (
    <div className="container" style={{ minHeight: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      <Link to="/admin/concerts" className="btn btn-outline" style={{ alignSelf: 'flex-start', marginBottom: '1.5rem', gap: '0.5rem' }}>
        <ArrowLeft size={16} /> Quay lại sự kiện
      </Link>

      <header className="section-heading">
        <div>
          <h1>VIP Guest List & Imports</h1>
          <p>Manage VIP guests and run batch CSV imports with real-time status updates.</p>
        </div>
      </header>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="split-layout">
        {/* Left Side: Guest List Table */}
        <div>
          <div className="card" style={{ marginBottom: '2rem' }}>
            <div className="card-body">
              <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>VIP Guest List ({totalItems})</h2>

              <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label htmlFor="guest-search" className="form-label" style={{ display: 'none' }}>Search Guests</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="guest-search"
                      type="text"
                      placeholder="Search guests by name or email..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="form-control"
                      style={{ width: '100%', paddingLeft: '2.5rem' }}
                    />
                    <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" style={{ gap: '0.5rem' }}>
                  Search
                </button>
              </form>

              {loadingList ? (
                <div className="flex-center" style={{ padding: '3rem' }}>
                  <div className="spinner" />
                </div>
              ) : guests.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>No VIP guests found.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Full Name</th>
                        <th>Email</th>
                        <th>Company</th>
                        <th>Check-in Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {guests.map((g) => (
                        <tr key={g.id}>
                          <td style={{ fontWeight: 600 }}>{g.fullName}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{g.email}</td>
                          <td>{g.affiliateCompany || 'N/A'}</td>
                          <td>
                            <span className={`badge ${g.checkinStatus === 'checked_in' ? 'badge-primary' : ''}`}>
                              {g.checkinStatus === 'checked_in' ? 'Checked In' : 'Not Checked In'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex-between" style={{ marginTop: '2.5rem' }}>
                  <button
                    className="btn btn-outline"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', gap: '0.25rem' }}
                  >
                    <ChevronLeft size={16} /> Prev
                  </button>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    className="btn btn-outline"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === totalPages}
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', gap: '0.25rem' }}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: CSV Import Panel */}
        <aside className="aside-sticky" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Import VIP Guests</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Upload a CSV file containing columns: `fullName`, `email`, `phone`, `affiliateCompany`.
          </p>

          <form onSubmit={handleImportSubmit} style={{ marginBottom: '2rem' }}>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="csv-file" className="form-label">Select CSV File</label>
              <input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                required
                className="form-control"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', gap: '0.5rem' }}
              disabled={uploading || !csvFile}
            >
              <Upload size={18} /> {uploading ? 'Uploading...' : 'Import CSV'}
            </button>
          </form>

          {/* Real-time Import Progress Bar */}
          {importJob && (
            <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
              <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Import Progress</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 600 }}>
                  {getProgressPercentage()}%
                </span>
              </div>

              {/* Progress bar container */}
              <div className="progress-track" style={{ marginBottom: '0.75rem' }}>
                <div className="progress-fill" style={{ width: `${getProgressPercentage()}%` }} />
              </div>

              <div className="flex-between" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>Status: <strong style={{ color: importJob.status === 'failed' ? 'var(--danger)' : 'var(--text-strong)' }}>{importJob.status}</strong></span>
                <span>{importJob.importedRows || 0} / {importJob.totalRows || 0} rows</span>
              </div>

              {/* Warnings / Errors in CSV */}
              {importJob.status === 'completed' && importJob.errorLogs && importJob.errorLogs.length > 0 && (
                <div style={{ marginTop: '2rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--warning)', marginBottom: '0.75rem' }}>
                    <AlertTriangle size={18} />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Import Warnings ({importJob.errorLogs.length})</span>
                  </div>

                  <div className="table-wrap" style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.8rem' }}>
                    <table className="data-table">
                      <thead style={{ backgroundColor: 'var(--surface-alt)', position: 'sticky', top: 0 }}>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Row</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Email</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importJob.errorLogs.map((log, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.5rem' }}>{log.row}</td>
                            <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>{log.email || 'N/A'}</td>
                            <td style={{ padding: '0.5rem', color: 'var(--danger)' }}>{log.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
