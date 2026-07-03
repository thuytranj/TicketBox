import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useSocket } from '../socket/SocketContext';
import { ArrowLeft, Upload, RefreshCw, FileText, CheckCircle, AlertTriangle } from 'lucide-react';

interface ConcertAIBio {
  concertId: string;
  draftBio: string | null;
  status: 'processing' | 'completed' | 'failed';
  error: string | null;
  updatedAt: string;
}

export const AiBiography: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { socket } = useSocket();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [bioData, setBioData] = useState<ConcertAIBio | null>(null);
  const [biographyText, setBiographyText] = useState('');
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const fetchBioStatus = async (showLoading = false) => {
    if (!id) return;
    if (showLoading) setLoading(true);
    try {
      const data = await apiClient.request<ConcertAIBio>(`/concerts/${id}/artist-bio`);
      setBioData(data);
      if (data.draftBio) {
        setBiographyText(data.draftBio);
      }
      setError('');
    } catch (err: any) {
      if (err.status === 404 || err.message?.includes('404')) {
        setBioData(null);
      } else {
        setError(err.message || 'Failed to fetch artist biography status');
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchBioStatus(true);
  }, [id]);

  // Listen to Socket notifications
  useEffect(() => {
    if (!socket || !id) return;

    const handleNotification = (notification: any) => {
      // Check if this notification is for our current concert's bio status
      const notificationType = String(notification.type || '').toLowerCase();
      if (
        (notificationType === 'ai_bio_completed' || notificationType === 'ai_bio_failed') &&
        notification.referenceId === id
      ) {
        fetchBioStatus(false);
      }
    };

    socket.on('notification_received', handleNotification);

    return () => {
      socket.off('notification_received', handleNotification);
    };
  }, [socket, id]);

  // Poll status while processing
  useEffect(() => {
    if (!bioData || bioData.status !== 'processing') return;

    const interval = setInterval(() => {
      fetchBioStatus(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [bioData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPdfFile(e.target.files[0]);
      setError('');
    }
  };

  const handleUploadPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !pdfFile) return;

    setUploadingPdf(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('file', pdfFile);

    try {
      await apiClient.request(`/concerts/${id}/artist-bio`, {
        method: 'POST',
        body: formData,
      });
      setSuccess('PDF profile uploaded successfully. Biography generation is in progress.');
      setPdfFile(null);
      
      // Instantly set state to processing
      setBioData({
        concertId: id,
        draftBio: null,
        status: 'processing',
        error: null,
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      setError(err.message || 'Failed to upload PDF profile');
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleConfirmBio = async () => {
    if (!id) return;
    setError('');
    setSuccess('');
    try {
      await apiClient.request(`/concerts/${id}/artist-bio/confirm`, {
        method: 'PUT',
        body: JSON.stringify({ biography: biographyText }),
      });
      setSuccess('Biography approved and confirmed successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to confirm biography');
    }
  };

  const handleRegenerate = async () => {
    if (!id) return;
    if (!window.confirm('Are you sure you want to regenerate the biography?')) return;
    setError('');
    setSuccess('');
    try {
      await apiClient.request(`/concerts/${id}/artist-bio/regenerate`, {
        method: 'POST',
      });
      setSuccess('Bio regeneration requested successfully.');
      setBioData({
        concertId: id,
        draftBio: null,
        status: 'processing',
        error: null,
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      setError(err.message || 'Failed to trigger bio regeneration');
    }
  };

  return (
    <div className="container" style={{ minHeight: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      <Link to="/admin/concerts" className="btn btn-outline" style={{ alignSelf: 'flex-start', marginBottom: '1.5rem', gap: '0.5rem' }}>
        <ArrowLeft size={16} /> Quay lại sự kiện
      </Link>

      <header className="section-heading">
        <div>
          <h1>AI Artist Biography</h1>
          <p>Generate or edit an engaging biography for your performing artists using AI.</p>
        </div>
      </header>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {loading ? (
        <div className="flex-center" style={{ flex: 1, padding: '4rem' }}>
          <div className="spinner" />
        </div>
      ) : !bioData ? (
        // No biography request exists yet
        <div className="card">
          <div className="card-body" style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="flex-center" style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
              <FileText size={64} />
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>No Biography Generated</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '500px', margin: '0 auto 2rem auto' }}>
              Upload a PDF document containing the artist profile, background info, and achievements. Our AI worker will extract and generate an event biography.
            </p>

            <form onSubmit={handleUploadPdf} style={{ maxWidth: '400px', margin: '0 auto' }}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label htmlFor="artist-pdf" className="form-label" style={{ textAlign: 'left' }}>Artist Profile (PDF only)</label>
                <input
                  id="artist-pdf"
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  required
                  className="form-control"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', gap: '0.5rem' }}
                disabled={uploadingPdf || !pdfFile}
              >
                <Upload size={18} /> {uploadingPdf ? 'Uploading...' : 'Generate Biography'}
              </button>
            </form>
          </div>
        </div>
      ) : bioData.status === 'processing' ? (
        // Processing status
        <div className="card">
          <div className="card-body" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <div className="flex-center" style={{ marginBottom: '2rem' }}>
              <div className="spinner" style={{ width: '64px', height: '64px', borderWidth: '5px' }} />
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Generating Biography</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '500px', margin: '0 auto' }}>
              We are processing your PDF file and generating the biography. This typically takes up to a minute.
              This page will update automatically in real time once completed.
            </p>
          </div>
        </div>
      ) : bioData.status === 'failed' ? (
        // Failed status
        <div className="card">
          <div className="card-body" style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="flex-center" style={{ marginBottom: '1.5rem', color: 'var(--danger)' }}>
              <AlertTriangle size={64} />
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--danger)' }}>Generation Failed</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '500px', margin: '0 auto 2rem auto' }}>
              An error occurred during AI biography generation: {bioData.error || 'Unknown parsing or generation error.'}
            </p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button onClick={() => setBioData(null)} className="btn btn-outline">
                Upload Different File
              </button>
              <button onClick={handleRegenerate} className="btn btn-primary" style={{ gap: '0.5rem' }}>
                <RefreshCw size={18} /> Retry Generation
              </button>
            </div>
          </div>
        </div>
      ) : (
        // Completed status
        <div className="card">
          <div className="card-body">
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <CheckCircle size={24} style={{ color: 'var(--success)' }} />
                <div>
                  <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Generated Draft Biography</h2>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Last updated: {new Date(bioData.updatedAt).toLocaleString()}
                  </span>
                </div>
              </div>
              <button onClick={handleRegenerate} className="btn btn-outline" style={{ gap: '0.5rem', padding: '0.5rem 1rem' }}>
                <RefreshCw size={16} /> Regenerate
              </button>
            </div>

            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label htmlFor="bio-text" className="form-label">Review and Edit Biography</label>
              <textarea
                id="bio-text"
                rows={12}
                value={biographyText}
                onChange={(e) => setBiographyText(e.target.value)}
                className="form-control"
                style={{ resize: 'vertical', lineHeight: '1.6' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <Link to="/admin/concerts" className="btn btn-outline">
                Cancel
              </Link>
              <button onClick={handleConfirmBio} className="btn btn-primary">
                Confirm and Publish Biography
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
