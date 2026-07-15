/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../api/client';
import type { Concert } from '../concerts/ConcertList';
import { Plus, Edit2, Trash2, CalendarDays, MapPin, Tag, Music2, ChevronRight, LayoutList, Search, Map as MapIcon, AlertTriangle, Upload } from 'lucide-react';
import heroPreview from '../../assets/hero.png';
import { useSocket } from '../socket/SocketContext';

const formatTicketDate = (dateStr?: string | null) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${hours}:${minutes} ${day}/${month}/${year}`;
};

const formatInputWithCommas = (value: number | string) => {
  if (value === undefined || value === null) return '';
  const isNegative = value.toString().startsWith('-');
  const numStr = value.toString().replace(/\D/g, '');
  if (!numStr) return isNegative ? '-' : '';
  const formatted = Number(numStr).toLocaleString('en-US');
  return isNegative ? `-${formatted}` : formatted;
};

interface TicketType {
  id: string;
  name: 'GA' | 'SVIP' | 'VIP' | 'CAT1' | 'CAT2';
  price: number;
  totalQuantity: number;
  availableQuantity: number;
  maxPerUser: number;
}

type TicketTypeName = TicketType['name'];
type ConcertStatus = 'draft' | 'active' | 'cancelled' | 'completed';

interface FormTicketType {
  id?: string;
  clientId?: string;
  name: TicketTypeName;
  price: number;
  totalQuantity: number;
  availableQuantity: number;
  maxPerUser: number;
  saleStartTime?: string | null;
  saleEndTime?: string | null;
}

interface ConcertAIBio {
  concertId: string;
  draftBio: string | null;
  status: 'processing' | 'completed' | 'failed';
  error: string | null;
  updatedAt: string;
}

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

export const AdminConcerts: React.FC = () => {
  const { socket } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get('status');
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ConcertStatus>(
    initialStatus === 'active' || initialStatus === 'draft' || initialStatus === 'cancelled' || initialStatus === 'completed' ? initialStatus : 'all'
  );

  // Form states (Derived from searchParams to support browser back button navigation)
  const showForm = searchParams.get('form') === 'open';
  const setShowForm = (open: boolean) => {
    const newParams = new URLSearchParams(searchParams);
    if (open) {
      newParams.set('form', 'open');
    } else {
      newParams.delete('form');
    }
    setSearchParams(newParams);
  };
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [showSvgSource, setShowSvgSource] = useState(false);
  const [showSvgZoom, setShowSvgZoom] = useState(false);
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

  // Step 2 states (AI Bio)
  const [biographyText, setBiographyText] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [bioData, setBioData] = useState<ConcertAIBio | null>(null);

  // Step 3 states (VIP Guests)
  const [vipCsvFile, setVipCsvFile] = useState<File | null>(null);
  const [importingVip, setImportingVip] = useState(false);
  const [vipImportJob, setVipImportJob] = useState<VipGuestImport | null>(null);
  const [vipGuestsList, setVipGuestsList] = useState<VipGuest[]>([]);
  const [showErrorTable, setShowErrorTable] = useState(false);

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
  const [newTicketSaleStart, setNewTicketSaleStart] = useState('');
  const [newTicketSaleEnd, setNewTicketSaleEnd] = useState('');
  const [editTicketSaleStart, setEditTicketSaleStart] = useState('');
  const [editTicketSaleEnd, setEditTicketSaleEnd] = useState('');

  // Custom Modal States
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const triggerConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText?: string
  ) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      confirmText,
      onConfirm: () => {
        onConfirm();
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const filteredConcerts = useMemo(() => {
    if (statusFilter === 'all') return concerts;
    return concerts.filter((concert) => concert.status === statusFilter);
  }, [concerts, statusFilter]);

  const fetchBioData = async (concertId: string) => {
    try {
      const data = await apiClient.request<ConcertAIBio>(`/concerts/${concertId}/artist-bio`);
      setBioData(data);
      if (data.draftBio) {
        setBiographyText(data.draftBio);
      }
    } catch (err: any) {
      if (
        err.statusCode === 404 ||
        err.status === 404 ||
        err.message?.includes('404') ||
        err.message?.includes('No AI bio')
      ) {
        setBioData(null);
      } else {
        setError('Không thể tải trạng thái tiểu sử AI: ' + err.message);
      }
    }
  };

  const fetchVipGuests = async (concertId: string) => {
    try {
      const res = await apiClient.request<{
        data: VipGuest[];
        meta: { totalPages: number; totalItems: number };
      }>(`/concerts/${concertId}/guests?page=1&limit=100`);
      setVipGuestsList(res.data || []);
    } catch (err: any) {
      setError('Không thể tải danh sách khách VIP: ' + err.message);
    }
  };

  // Clean up ?form=open param on refresh if there is no active concert editing or creation session
  useEffect(() => {
    const isFormParamOpen = searchParams.get('form') === 'open';
    if (isFormParamOpen && !editingConcertId && !isCreateMode) {
      const newParams = new URLSearchParams(window.location.search);
      newParams.delete('form');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams, editingConcertId, isCreateMode]);

  // Listen to Socket notifications for Step 2 AI Biography
  useEffect(() => {
    if (!socket || !editingConcertId) return;

    const handleNotification = (notification: any) => {
      const notificationType = String(notification.type || '').toLowerCase();
      if (
        (notificationType === 'ai_bio_completed' || notificationType === 'ai_bio_failed') &&
        notification.referenceId === editingConcertId
      ) {
        fetchBioData(editingConcertId);
      }
    };

    socket.on('notification_received', handleNotification);

    return () => {
      socket.off('notification_received', handleNotification);
    };
  }, [socket, editingConcertId]);

  // Poll status while processing in Step 2 AI Biography
  useEffect(() => {
    if (!bioData || bioData.status !== 'processing' || !editingConcertId) return;

    const interval = setInterval(() => {
      fetchBioData(editingConcertId);
    }, 3000);

    return () => clearInterval(interval);
  }, [bioData, editingConcertId]);

  // Socket notification listener for Step 3 VIP guests import
  const vipImportJobRef = useRef(vipImportJob);
  useEffect(() => {
    vipImportJobRef.current = vipImportJob;
  }, [vipImportJob]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (!socket || !editingConcertId) return;

    const handleImportStatus = (job: any) => {
      const currentJob = vipImportJobRef.current;
      if (currentJob && job.id === currentJob.id) {
        setVipImportJob(job);
        if (job.status === 'completed') {
          setSuccess('Đã import thành công danh sách khách VIP.');
          fetchVipGuests(editingConcertId);
        } else if (job.status === 'failed') {
          setError('Import danh sách khách VIP thất bại.');
        }
      }
    };

    socket.on('vip_import_status', handleImportStatus);

    return () => {
      socket.off('vip_import_status', handleImportStatus);
    };
  }, [socket, editingConcertId]);

  // Fallback Polling for Step 3 VIP guests import status
  useEffect(() => {
    if (!vipImportJob) return;
    if (vipImportJob.status === 'completed' || vipImportJob.status === 'failed') return;

    const pollVipJobStatus = async (jobId: string) => {
      if (!editingConcertId) return;
      try {
        const job = await apiClient.request<VipGuestImport>(`/concerts/${editingConcertId}/guests/imports/${jobId}`);
        setVipImportJob(job);
        if (job.status === 'completed' || job.status === 'failed') {
          if (job.status === 'completed') {
            setSuccess('Đã import thành công danh sách khách VIP.');
            fetchVipGuests(editingConcertId);
          } else {
            setError('Import danh sách khách VIP thất bại.');
          }
        }
      } catch (err: any) {
        console.error('Failed to poll VIP job status:', err);
      }
    };

    const interval = setInterval(() => {
      pollVipJobStatus(vipImportJob.id);
    }, 3000);

    return () => clearInterval(interval);
  }, [vipImportJob, editingConcertId]);

  const fetchConcerts = async () => {
    setLoading(true);
    try {
      const statuses: ConcertStatus[] = ['active', 'draft', 'cancelled', 'completed'];
      const responses = await Promise.all(
        statuses.map((concertStatus) =>
          apiClient
            .request<{ concerts: Concert[] }>(`/concerts?status=${concertStatus}&page=1&limit=100`)
            .catch(() => ({ concerts: [] }))
        )
      );
      let loadedConcerts = responses.flatMap((response) => response?.concerts || []);

      if (loadedConcerts.length === 0) {
        const fallback = await apiClient.request<{ concerts: Concert[] }>('/concerts?page=1&limit=100');
        loadedConcerts = fallback?.concerts || [];
      }

      const uniqueConcerts = Array.from(new Map(loadedConcerts.map((concert) => [concert.id, concert])).values());
      uniqueConcerts.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      setConcerts(uniqueConcerts);
    } catch (err: any) {
      setError(err.message || 'Không tải được danh sách sự kiện');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchConcerts();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      handleOpenCreate();
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('action');
        return next;
      });
    }
  }, [searchParams]);

  useEffect(() => {
    if (concerts.length > 0) {
      const action = searchParams.get('action');
      const id = searchParams.get('id');
      const step = searchParams.get('step');
      
      if (action === 'edit' && id) {
        const targetConcert = concerts.find((c) => c.id === id);
        if (targetConcert) {
          const targetStep = (step ? Number(step) : 1) as 1 | 2 | 3;
          handleOpenEdit(targetConcert, targetStep);
        } else {
          setError('Không tìm thấy sự kiện này (sự kiện không tồn tại hoặc đã bị hủy bỏ bản nháp).');
        }
        
        // Luôn dọn dẹp các tham số query trên URL để tránh bị kẹt hoặc lặp lại hành động
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.delete('action');
          next.delete('id');
          next.delete('step');
          return next;
        });
      }
    }
  }, [concerts, searchParams]);

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
    setBiographyText('');
    setPdfFile(null);
    setUploadingPdf(false);
    setBioData(null);
    setVipCsvFile(null);
    setImportingVip(false);
    setVipImportJob(null);
    setVipGuestsList([]);
    setIsCreateMode(true);
    setShowSvgSource(false);
    setShowForm(true);
  };

  const handleOpenEdit = async (concert: Concert, initialStep?: 1 | 2 | 3) => {
    setIsCreateMode(false);
    setShowSvgSource(false);
    setEditingConcertId(concert.id);
    setTitle(concert.title);
    setDescription(concert.description);
    setLocation(concert.location);
    // Parse times to datetime-local compatible string
    setStartTime(new Date(concert.startTime).toISOString().substring(0, 16));
    setEndTime(new Date(new Date(concert.startTime).getTime() + 3 * 3600000).toISOString().substring(0, 16));
    setStatus(concert.status);
    setTagsInput((concert.tags || []).join(', '));
    setPosterUrl(concert.posterUrl || '');
    setEditingTicketTypeId(null);
    setBiographyText(concert.biography || '');
    setPdfFile(null);
    setUploadingPdf(false);
    setBioData(null);
    setVipCsvFile(null);
    setImportingVip(false);
    setVipImportJob(null);
    setVipGuestsList([]);
    setCurrentStep(initialStep || 1);
    setError('');
    setSuccess('');
    setShowForm(true);

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

  const handleCloseOrCancel = () => {
    if (isCreateMode) {
      triggerConfirm(
        'Xác nhận hủy bỏ',
        editingConcertId
          ? 'Bạn có chắc chắn muốn thoát? Quy trình tạo sự kiện chưa hoàn tất sẽ bị hủy bỏ và các thông tin đã nhập sẽ bị xóa.'
          : 'Bạn có chắc chắn muốn thoát?',
        async () => {
          if (editingConcertId) {
            try {
              await apiClient.request(`/concerts/${editingConcertId}`, {
                method: 'DELETE',
              });
            } catch (e) {
              console.error('Failed to cleanup draft concert:', e);
            }
          }
          setShowForm(false);
          fetchConcerts();
        },
        'Thoát'
      );
    } else {
      setShowForm(false);
      fetchConcerts();
    }
  };

  const handleStepClick = (step: 1 | 2 | 3) => {
    if (!isCreateMode || editingConcertId) {
      if (step === 2 && editingConcertId) {
        fetchBioData(editingConcertId);
      } else if (step === 3 && editingConcertId) {
        fetchVipGuests(editingConcertId);
      }
      setCurrentStep(step);
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

  const handleSubmitConcert = async (e?: React.FormEvent, shouldClose = false) => {
    if (e) e.preventDefault();
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
            saleStartTime: type.saleStartTime || undefined,
            saleEndTime: type.saleEndTime || undefined,
          })),
    };

    try {
      let concertId = editingConcertId;
      if (editingConcertId) {
        await apiClient.request(`/concerts/${editingConcertId}`, {
          method: 'PATCH',
          body: JSON.stringify(bodyData),
        });
        setSuccess('Đã cập nhật sự kiện.');
      } else {
        const res = await apiClient.request<{ id: string }>('/concerts', {
          method: 'POST',
          body: JSON.stringify(bodyData),
        });
        concertId = res.id;
        setEditingConcertId(res.id);
        setSuccess('Đã tạo sự kiện.');
      }

      if (shouldClose) {
        setShowForm(false);
        fetchConcerts();
        return;
      }

      if (concertId) {
        fetchBioData(concertId);
      }
      setCurrentStep(2);
    } catch (err: any) {
      setError(err.message || 'Không lưu được sự kiện');
    }
  };

  const handleGenerateAiBio = async () => {
    if (!editingConcertId) return;
    setUploadingPdf(true);
    setError('');
    setSuccess('');
    try {
      if (!pdfFile) {
        setError('Vui lòng chọn file PDF.');
        setUploadingPdf(false);
        return;
      }
      const formData = new FormData();
      formData.append('file', pdfFile);
      await apiClient.request(`/concerts/${editingConcertId}/artist-bio`, {
        method: 'POST',
        body: formData,
      });
      setSuccess('Đã tải lên hồ sơ nghệ sĩ PDF. Đang sinh tiểu sử bằng AI...');
      setBioData({
        concertId: editingConcertId,
        draftBio: null,
        status: 'processing',
        error: null,
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      setError('Lỗi khi tải file PDF: ' + err.message);
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleRegenerateAiBio = async () => {
    if (!editingConcertId) return;
    setUploadingPdf(true);
    setError('');
    setSuccess('');
    try {
      await apiClient.request(`/concerts/${editingConcertId}/artist-bio/regenerate`, {
        method: 'POST',
      });
      setSuccess('Đã yêu cầu sinh lại tiểu sử bằng AI...');
      setBioData({
        concertId: editingConcertId,
        draftBio: null,
        status: 'processing',
        error: null,
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      setError('Lỗi khi sinh lại tiểu sử: ' + err.message);
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleSaveStep2 = async (shouldClose = false) => {
    if (!editingConcertId) return;
    setError('');
    setSuccess('');
    try {
      await apiClient.request(`/concerts/${editingConcertId}/artist-bio/confirm`, {
        method: 'PUT',
        body: JSON.stringify({ biography: biographyText }),
      });
      setSuccess('Đã lưu và xác nhận tiểu sử nghệ sĩ.');
      
      if (shouldClose) {
        setShowForm(false);
        fetchConcerts();
        return;
      }

      fetchVipGuests(editingConcertId);
      setCurrentStep(3);
    } catch (err: any) {
      setError('Lỗi khi lưu tiểu sử: ' + err.message);
    }
  };

  const handleImportVipGuests = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConcertId || !vipCsvFile) return;

    setImportingVip(true);
    setError('');
    setSuccess('');
    setVipImportJob(null);

    const formData = new FormData();
    formData.append('file', vipCsvFile);

    try {
      const res = await apiClient.request<{ jobId: string; status: VipGuestImport['status'] }>(
        `/concerts/${editingConcertId}/guests/import`,
        {
          method: 'POST',
          body: formData,
        }
      );
      setSuccess('Đã tải lên CSV. Đang xử lý danh sách khách VIP...');
      setVipCsvFile(null);

      setVipImportJob({
        id: res.jobId,
        concertId: editingConcertId,
        status: res.status,
        totalRows: 0,
        importedRows: 0,
        errorLogs: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      setError('Lỗi khi import danh sách khách VIP: ' + err.message);
    } finally {
      setImportingVip(false);
    }
  };

  const handleDownloadErrorCsv = (job: VipGuestImport) => {
    if (!job.errorLogs || job.errorLogs.length === 0) return;
    const headers = 'Dòng,Email,Lý do lỗi\n';
    const rows = job.errorLogs
      .map((log) => `${log.row},"${log.email || ''}","${log.reason}"`)
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `import_errors_${job.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getProgressPercentage = () => {
    if (!vipImportJob || !vipImportJob.totalRows || vipImportJob.totalRows === 0) return 0;
    return Math.min(100, Math.round(((vipImportJob.importedRows || 0) / vipImportJob.totalRows) * 100));
  };

  const handleDeleteConcert = async (concertId: string) => {
    triggerConfirm(
      'Xác nhận xóa sự kiện',
      'Bạn chắc chắn muốn xóa sự kiện này? Hành động này không thể hoàn tác.',
      async () => {
        setError('');
        setSuccess('');
        try {
          await apiClient.request(`/concerts/${concertId}`, {
            method: 'DELETE',
          });
          setSuccess('Đã xóa sự kiện.');
          fetchConcerts();
        } catch (err: any) {
          setError(
            err.message ||
              'Không thể xóa sự kiện. Nếu đã có đơn đặt vé, hãy cân nhắc chuyển trạng thái sang đã hủy.'
          );
        }
      },
      'Xóa'
    );
  };

  // Ticket Types functions
  const handleAddTicketType = async () => {
    const trimmedName = newTicketName.trim() as TicketTypeName;
    if (!trimmedName) {
      setError('Tên hạng vé không được để trống.');
      return;
    }
    if (newTicketPrice < 0) {
      setError('Giá vé không được âm.');
      return;
    }
    if (newTicketQty < 1) {
      setError('Số lượng vé phải lớn hơn 0.');
      return;
    }
    if (newTicketMaxUser < 1) {
      setError('Tối đa/người phải lớn hơn 0.');
      return;
    }

    const isDuplicate = ticketTypes.some(
      (t) => t.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      setError(`Hạng vé "${trimmedName}" đã tồn tại trong concert này. Vui lòng chọn tên khác.`);
      return;
    }

    const nextTicketType: FormTicketType = {
      clientId: crypto.randomUUID(),
      name: trimmedName,
      price: newTicketPrice,
      totalQuantity: newTicketQty,
      availableQuantity: newTicketQty,
      maxPerUser: newTicketMaxUser,
      saleStartTime: newTicketSaleStart ? new Date(newTicketSaleStart).toISOString() : undefined,
      saleEndTime: newTicketSaleEnd ? new Date(newTicketSaleEnd).toISOString() : undefined,
    };

    if (!editingConcertId) {
      setTicketTypes((current) => [...current, nextTicketType]);
      setSuccess('Đã thêm hạng vé vào concert mới.');
      setNewTicketSaleStart('');
      setNewTicketSaleEnd('');
      return;
    }

    setAddingTicketType(true);
    setError('');
    try {
      await apiClient.request(`/concerts/${editingConcertId}/ticket-types`, {
        method: 'POST',
        body: JSON.stringify({
          name: trimmedName,
          price: newTicketPrice,
          totalQuantity: newTicketQty,
          maxPerUser: newTicketMaxUser,
          saleStartTime: newTicketSaleStart ? new Date(newTicketSaleStart).toISOString() : null,
          saleEndTime: newTicketSaleEnd ? new Date(newTicketSaleEnd).toISOString() : null,
        }),
      });
      setSuccess('Đã thêm hạng vé.');
      setNewTicketSaleStart('');
      setNewTicketSaleEnd('');
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
    triggerConfirm(
      'Xác nhận xóa hạng vé',
      `Bạn chắc chắn muốn xóa hạng vé "${type.name}" này?`,
      async () => {
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
      },
      'Xóa'
    );
  };

  const handleStartEditTicketType = (type: FormTicketType) => {
    if (!type.id) return;
    setEditingTicketTypeId(type.id);
    setEditTicketName(type.name);
    setEditTicketPrice(type.price);
    setEditTicketQty(type.totalQuantity);
    setEditTicketMaxUser(type.maxPerUser);

    const toLocalDateTimeString = (dateStr?: string | Date | null) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const offset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - offset).toISOString().slice(0, 16);
    };

    setEditTicketSaleStart(toLocalDateTimeString(type.saleStartTime));
    setEditTicketSaleEnd(toLocalDateTimeString(type.saleEndTime));

    setError('');
    setSuccess('');
  };

  const handleCancelEditTicketType = () => {
    setEditingTicketTypeId(null);
    setEditTicketSaleStart('');
    setEditTicketSaleEnd('');
    setError('');
  };

  const handleUpdateTicketType = async () => {
    if (!editingTicketTypeId) return;
    if (editTicketPrice < 0) {
      setError('Giá vé không được âm.');
      return;
    }
    if (editTicketQty < 1) {
      setError('Số lượng vé phải lớn hơn 0.');
      return;
    }
    if (editTicketMaxUser < 1) {
      setError('Tối đa/người phải lớn hơn 0.');
      return;
    }

    setUpdatingTicketType(true);
    setError('');
    setSuccess('');

    const body = {
      name: editTicketName,
      price: editTicketPrice,
      totalQuantity: editTicketQty,
      maxPerUser: editTicketMaxUser,
      saleStartTime: editTicketSaleStart ? new Date(editTicketSaleStart).toISOString() : null,
      saleEndTime: editTicketSaleEnd ? new Date(editTicketSaleEnd).toISOString() : null,
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
          <h1>Sự kiện</h1>
          <p>Quản lý sự kiện, hạng vé, poster và khách mời trong một nơi.</p>
        </div>
        {!showForm && (
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={18} style={{ marginRight: '0.5rem' }} /> Tạo sự kiện
          </button>
        )}
      </header>

      {error && (
        <div className="alert alert-danger" role="alert" style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 99999,
          boxShadow: '0 10px 15px -3px rgba(239, 68, 68, 0.2), 0 4px 6px -2px rgba(239, 68, 68, 0.1)',
          borderRadius: '12px',
          padding: '1rem 1.5rem',
          maxWidth: '380px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          borderLeft: '4px solid var(--danger)',
          backgroundColor: '#fef2f2',
          color: '#991b1b',
        }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 99999,
          boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.2), 0 4px 6px -2px rgba(16, 185, 129, 0.1)',
          borderRadius: '12px',
          padding: '1rem 1.5rem',
          maxWidth: '380px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          borderLeft: '4px solid var(--success)',
          backgroundColor: '#f0fdf4',
          color: '#166534',
        }}>
          <span style={{ fontSize: '1.2rem' }}>✓</span>
          <span>{success}</span>
        </div>
      )}

      {showForm ? (
        <div className="card" style={{ marginBottom: '3rem' }}>
          <div className="card-body">
            <div className="flex-between" style={{ marginBottom: '2rem', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.5rem', margin: 0 }}>
                {editingConcertId ? 'Chỉnh sửa sự kiện' : 'Tạo sự kiện mới'}
              </h2>
            </div>
            
            {/* Step Indicator */}
            <div className="wizard-steps" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
              <div 
                className={`step-item ${currentStep === 1 ? 'active' : ''}`} 
                style={{ 
                  flex: 1, 
                  textAlign: 'center', 
                  opacity: currentStep === 1 ? 1 : 0.6, 
                  fontWeight: currentStep === 1 ? 600 : 400,
                  cursor: (!isCreateMode || editingConcertId) ? 'pointer' : 'not-allowed'
                }}
                onClick={() => handleStepClick(1)}
              >
                <div className="step-number" style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: currentStep === 1 ? 'var(--primary)' : 'var(--border)', color: currentStep === 1 ? '#fff' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>1</div>
                <div>Cấu hình sự kiện & hạng vé</div>
              </div>
              <div 
                className={`step-item ${currentStep === 2 ? 'active' : ''}`} 
                style={{ 
                  flex: 1, 
                  textAlign: 'center', 
                  opacity: currentStep === 2 ? 1 : 0.6, 
                  fontWeight: currentStep === 2 ? 600 : 400,
                  cursor: (!isCreateMode || editingConcertId) ? 'pointer' : 'not-allowed'
                }}
                onClick={() => handleStepClick(2)}
              >
                <div className="step-number" style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: currentStep === 2 ? 'var(--primary)' : 'var(--border)', color: currentStep === 2 ? '#fff' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>2</div>
                <div>Tiểu sử nghệ sĩ</div>
              </div>
              <div 
                className={`step-item ${currentStep === 3 ? 'active' : ''}`} 
                style={{ 
                  flex: 1, 
                  textAlign: 'center', 
                  opacity: currentStep === 3 ? 1 : 0.6, 
                  fontWeight: currentStep === 3 ? 600 : 400,
                  cursor: (!isCreateMode || editingConcertId) ? 'pointer' : 'not-allowed'
                }}
                onClick={() => handleStepClick(3)}
              >
                <div className="step-number" style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: currentStep === 3 ? 'var(--primary)' : 'var(--border)', color: currentStep === 3 ? '#fff' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>3</div>
                <div>Khách mời VIP</div>
              </div>
            </div>

            {currentStep === 1 && (
              <>
                <form id="concert-form" onSubmit={handleSubmitConcert} className="admin-form-grid">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="form-group">
                      <label htmlFor="concert-title" className="form-label">Tên sự kiện</label>
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
                        <option value="draft">Bản nháp</option>
                        <option value="active">Hoạt động</option>
                        <option value="cancelled">Đã hủy</option>
                        <option value="completed">Đã diễn ra</option>
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
                      <label htmlFor="concert-svg-map" className="form-label" style={{ fontWeight: 600 }}>Sơ đồ ghế SVG</label>
                      
                      <div style={{
                        border: '2px dashed var(--border)',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        textAlign: 'center',
                        backgroundColor: '#fafafa',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'border-color 0.2s ease-out'
                      }}
                      onClick={() => document.getElementById('concert-svg-file')?.click()}
                      >
                        <input
                          id="concert-svg-file"
                          type="file"
                          accept=".svg,image/svg+xml"
                          onChange={handleSvgUpload}
                          style={{ display: 'none' }}
                          aria-label="Tải file SVG"
                        />
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <Upload size={28} style={{ marginBottom: '0.5rem', color: 'var(--primary)' }} />
                          <span><strong>Nhấp để tải lên</strong> hoặc kéo thả file sơ đồ sân khấu SVG</span>
                        </div>
                      </div>

                      {svgStageMap && (
                        <div style={{
                          marginTop: '1.25rem',
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          padding: '1rem',
                          backgroundColor: '#f8fafc',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                              Xem trước sơ đồ ghế (Live Preview):
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowSvgZoom(true)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '3px 10px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                                background: 'var(--surface)',
                                color: 'var(--primary)',
                                cursor: 'pointer',
                              }}
                            >
                              <Search size={12} /> Phóng to
                            </button>
                          </div>
                          <div
                            onClick={() => setShowSvgZoom(true)}
                            style={{
                              width: '100%',
                              maxHeight: '220px',
                              overflow: 'hidden',
                              display: 'flex',
                              justifyContent: 'center',
                              backgroundColor: '#fff',
                              borderRadius: '8px',
                              padding: '0.5rem',
                              border: '1px solid var(--border)',
                              cursor: 'zoom-in',
                              position: 'relative',
                            }}
                            title="Nhấp để phóng to sơ đồ"
                            dangerouslySetInnerHTML={{ __html: svgStageMap }}
                          />
                        </div>
                      )}

                      {svgStageMap && (
                        <div style={{ marginTop: '0.75rem', textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn-link"
                            style={{
                              border: 'none',
                              background: 'none',
                              padding: 0,
                              fontSize: '0.8rem',
                              color: 'var(--primary)',
                              cursor: 'pointer',
                              textDecoration: 'underline'
                            }}
                            onClick={() => setShowSvgSource(!showSvgSource)}
                          >
                            {showSvgSource ? '▲ Ẩn mã nguồn SVG' : '▼ Hiển thị mã nguồn SVG'}
                          </button>
                        </div>
                      )}

                      <div style={{ display: (!svgStageMap || showSvgSource) ? 'block' : 'none', marginTop: '0.75rem' }}>
                        <textarea
                          id="concert-svg-map"
                          rows={6}
                          placeholder="Dán mã <svg>...</svg> trực tiếp vào đây nếu có..."
                          value={svgStageMap}
                          onChange={(e) => setSvgStageMap(e.target.value)}
                          className="form-control"
                          style={{ fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical', marginTop: '0.5rem' }}
                        />
                      </div>
                    </div>
                  </div>
                </form>

                {/* Ticket types section */}
                <div style={{ marginTop: '3.5rem', borderTop: '1px solid var(--border)', paddingTop: '2.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Quản lý hạng vé</h3>
                  
                  {/* Add ticket type mini-form */}
                  <div style={{ padding: '1.5rem', background: 'var(--surface-alt)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                      
                      {/* Cột 1: Thông tin cơ bản */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <h4 style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem', fontWeight: 700 }}>
                          Thông tin cơ bản
                        </h4>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label htmlFor="ticket-type-name" className="form-label">Hạng vé</label>
                          <input
                            id="ticket-type-name"
                            type="text"
                            className="form-control"
                            placeholder="GA, SVIP, VIP..."
                            value={newTicketName}
                            onChange={(e) => setNewTicketName(e.target.value as TicketTypeName)}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label htmlFor="ticket-type-price" className="form-label">Giá (VND)</label>
                          <input
                            id="ticket-type-price"
                            type="text"
                            className="form-control"
                            placeholder="0"
                            value={formatInputWithCommas(newTicketPrice)}
                            onChange={(e) => {
                              const isNeg = e.target.value.startsWith('-');
                              const val = Number(e.target.value.replace(/\D/g, ''));
                              setNewTicketPrice(isNeg ? -val : val);
                            }}
                          />
                        </div>
                      </div>

                      {/* Cột 2: Số lượng & Giới hạn */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <h4 style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem', fontWeight: 700 }}>
                          Số lượng & Giới hạn
                        </h4>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label htmlFor="ticket-type-qty" className="form-label">Số lượng</label>
                          <input id="ticket-type-qty" type="number" className="form-control" placeholder="0" value={newTicketQty || ''} onChange={(e) => setNewTicketQty(Number(e.target.value))} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label htmlFor="ticket-type-max" className="form-label">Tối đa/người</label>
                          <input id="ticket-type-max" type="number" className="form-control" placeholder="Tối đa" value={newTicketMaxUser || ''} onChange={(e) => setNewTicketMaxUser(Number(e.target.value))} />
                        </div>
                      </div>

                      {/* Cột 3: Cấu hình Thời gian Bán vé */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <h4 style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem', fontWeight: 700 }}>
                          Thời gian mở bán (Tùy chọn)
                        </h4>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label htmlFor="ticket-type-start" className="form-label">Thời gian mở bán (Bắt đầu)</label>
                          <input
                            id="ticket-type-start"
                            type="datetime-local"
                            className="form-control"
                            value={newTicketSaleStart}
                            onChange={(e) => setNewTicketSaleStart(e.target.value)}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label htmlFor="ticket-type-end" className="form-label">Thời gian kết thúc bán</label>
                          <input
                            id="ticket-type-end"
                            type="datetime-local"
                            className="form-control"
                            value={newTicketSaleEnd}
                            onChange={(e) => setNewTicketSaleEnd(e.target.value)}
                          />
                        </div>
                      </div>

                    </div>

                    {/* Hàng nút bấm thêm */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleAddTicketType}
                        disabled={addingTicketType}
                        style={{ padding: '8px 24px', display: 'inline-flex', alignItems: 'center', gap: '8px', height: '38px' }}
                      >
                        <Plus size={16} /> Thêm
                      </button>
                    </div>
                  </div>

                  {/* List of ticket types */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {ticketTypes.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)' }}>Chưa có hạng vé nào.</p>
                    ) : (
                      ticketTypes.map((type) => (
                        <div key={type.id || type.clientId} className="ticket-row">
                          {editingTicketTypeId === type.id ? (
                            <div style={{ flex: 1, padding: '1.5rem', background: 'var(--surface-alt)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                                
                                {/* Cột 1: Thông tin cơ bản đang sửa */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                  <h4 style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem', fontWeight: 700 }}>
                                    Thông tin cơ bản
                                  </h4>
                                  <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label htmlFor="edit-ticket-name" className="form-label">Hạng vé đang sửa</label>
                                    <input
                                      id="edit-ticket-name"
                                      type="text"
                                      className="form-control"
                                      placeholder="Tên hạng vé..."
                                      value={editTicketName}
                                      onChange={(e) => setEditTicketName(e.target.value as TicketTypeName)}
                                    />
                                  </div>
                                  <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label htmlFor="edit-ticket-price" className="form-label">Giá hạng vé đang sửa</label>
                                    <input
                                      id="edit-ticket-price"
                                      type="text"
                                      className="form-control"
                                      value={formatInputWithCommas(editTicketPrice)}
                                      onChange={(e) => {
                                        const isNeg = e.target.value.startsWith('-');
                                        const val = Number(e.target.value.replace(/\D/g, ''));
                                        setEditTicketPrice(isNeg ? -val : val);
                                      }}
                                    />
                                  </div>
                                </div>

                                {/* Cột 2: Số lượng & Giới hạn đang sửa */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                  <h4 style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem', fontWeight: 700 }}>
                                    Số lượng & Giới hạn
                                  </h4>
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
                                </div>

                                {/* Cột 3: Cấu hình Thời gian Bán vé đang sửa */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                  <h4 style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem', fontWeight: 700 }}>
                                    Thời gian mở bán
                                  </h4>
                                  <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label htmlFor="edit-ticket-start" className="form-label">Thời gian mở bán đang sửa</label>
                                    <input
                                      id="edit-ticket-start"
                                      type="datetime-local"
                                      className="form-control"
                                      value={editTicketSaleStart}
                                      onChange={(e) => setEditTicketSaleStart(e.target.value)}
                                    />
                                  </div>
                                  <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label htmlFor="edit-ticket-end" className="form-label">Thời gian kết thúc bán đang sửa</label>
                                    <input
                                      id="edit-ticket-end"
                                      type="datetime-local"
                                      className="form-control"
                                      value={editTicketSaleEnd}
                                      onChange={(e) => setEditTicketSaleEnd(e.target.value)}
                                    />
                                  </div>
                                </div>

                              </div>

                              {/* Hàng nút bấm lưu/hủy */}
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                                <button type="button" className="btn btn-outline" onClick={handleCancelEditTicketType} style={{ padding: '8px 20px', height: '38px' }}>
                                  Hủy
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  onClick={handleUpdateTicketType}
                                  disabled={updatingTicketType}
                                  style={{ padding: '8px 20px', height: '38px' }}
                                >
                                  Lưu hạng vé
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div>
                                <strong style={{ fontSize: '1.1rem', color: 'var(--text-strong)' }}>{type.name}</strong>
                                <span style={{ marginLeft: '1.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                  {type.price.toLocaleString()} VND
                                </span>
                                <span style={{ marginLeft: '1.5rem', color: 'var(--text-muted)' }}>
                                  Còn: <strong>{type.availableQuantity} / {type.totalQuantity}</strong>
                                </span>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', alignItems: 'center' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <CalendarDays size={13} /> Mở bán: {type.saleStartTime ? <strong>{formatTicketDate(type.saleStartTime)}</strong> : <em>Ngay khi hoạt động</em>}
                                </span>
                                <span style={{ color: 'var(--border-strong)' }}>|</span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <CalendarDays size={13} /> Kết thúc: {type.saleEndTime ? <strong>{formatTicketDate(type.saleEndTime)}</strong> : <em>Đến khi kết thúc sự kiện</em>}
                                </span>
                              </div>
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

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                  <div>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={isCreateMode ? { borderColor: 'var(--danger)', color: 'var(--danger)' } : undefined}
                      onClick={handleCloseOrCancel}
                    >
                      {isCreateMode ? 'Hủy bỏ' : 'Đóng'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    {editingConcertId && (
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ borderColor: 'var(--success)', color: 'var(--success)' }}
                        onClick={() => handleSubmitConcert(undefined, true)}
                        disabled={uploadingPoster}
                      >
                        {isCreateMode ? 'Lưu và thoát' : 'Lưu thay đổi'}
                      </button>
                    )}
                    <button type="submit" form="concert-form" className="btn btn-primary" disabled={uploadingPoster}>
                      Tiếp tục sang Tiểu sử nghệ sĩ
                    </button>
                  </div>
                </div>
              </>
            )}

            {currentStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <p style={{ color: 'var(--text-muted)' }}>
                  Tạo hoặc chỉnh sửa tiểu sử thu hút cho nghệ sĩ biểu diễn của bạn bằng trí tuệ nhân tạo (AI).
                </p>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label htmlFor="artist-pdf" className="form-label">Hồ sơ nghệ sĩ (Chỉ file PDF)</label>
                  <input
                    id="artist-pdf"
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setPdfFile(e.target.files[0]);
                      }
                    }}
                    className="form-control"
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ gap: '0.5rem' }}
                    onClick={handleGenerateAiBio}
                    disabled={uploadingPdf || !pdfFile}
                  >
                    Sinh tiểu sử bằng AI
                  </button>

                  {bioData && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ borderColor: 'var(--success)', color: 'var(--success)' }}
                      onClick={handleRegenerateAiBio}
                      disabled={uploadingPdf}
                    >
                      Sinh lại tiểu sử (Từ file cũ)
                    </button>
                  )}
                </div>

                {bioData && bioData.status === 'processing' && (
                  <div style={{ padding: '2rem', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', marginTop: '1rem' }}>
                    <div className="flex-center" style={{ marginBottom: '1rem' }}>
                      <div className="spinner" style={{ width: '32px', height: '32px' }} />
                    </div>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Đang sinh tiểu sử bằng AI. Vui lòng chờ...</p>
                  </div>
                )}

                {bioData && bioData.status === 'failed' && (
                  <div className="alert alert-danger" style={{ marginTop: '1rem', padding: '1rem', fontSize: '0.9rem' }}>
                    Sinh tiểu sử bằng AI thất bại. Bạn có thể tự nhập tiểu sử vào khung bên dưới để tiếp tục.
                  </div>
                )}

                <div className="form-group" style={{ marginTop: '1.5rem' }}>
                  <label htmlFor="bio-text" className="form-label">Tiểu sử nghệ sĩ</label>
                  <textarea
                    id="bio-text"
                    rows={10}
                    value={biographyText}
                    onChange={(e) => setBiographyText(e.target.value)}
                    className="form-control"
                    style={{ resize: 'vertical', lineHeight: '1.6' }}
                    placeholder="Tiểu sử nghệ sĩ hiển thị ở đây..."
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                  <div>
                    {isCreateMode ? (
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                        onClick={handleCloseOrCancel}
                      >
                        Hủy bỏ
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={handleCloseOrCancel}
                      >
                        Đóng
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="button" className="btn btn-outline" onClick={() => setCurrentStep(1)}>
                      Quay lại
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ borderColor: 'var(--success)', color: 'var(--success)' }}
                      onClick={() => handleSaveStep2(true)}
                    >
                      {isCreateMode ? 'Lưu và thoát' : 'Lưu thay đổi'}
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => handleSaveStep2(false)}>
                      Tiếp tục sang Khách VIP
                    </button>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <p style={{ color: 'var(--text-muted)' }}>
                  Nhập danh sách khách mời VIP bằng cách tải lên file CSV.
                </p>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label htmlFor="vip-csv" className="form-label">Tải file danh sách khách VIP (.csv)</label>
                  <input
                    id="vip-csv"
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setVipCsvFile(e.target.files[0]);
                      }
                    }}
                    className="form-control"
                  />
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    File CSV phải bao gồm các cột: `fullName`, `email`, `phone`, `affiliateCompany`.
                  </p>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ alignSelf: 'flex-start', gap: '0.5rem' }}
                  onClick={handleImportVipGuests}
                  disabled={importingVip || !vipCsvFile}
                >
                  Nhập danh sách khách VIP
                </button>

                {vipImportJob && (
                  <div style={{ marginTop: '1.5rem', border: '1px solid var(--border)', padding: '1rem', borderRadius: 'var(--radius)' }}>
                    <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Tiến độ nhập danh sách</span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 600 }}>
                        {getProgressPercentage()}%
                      </span>
                    </div>
                    <div className="progress-track" style={{ marginBottom: '0.75rem', height: '8px', backgroundColor: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div className="progress-fill" style={{ width: `${getProgressPercentage()}%`, height: '100%', backgroundColor: 'var(--primary)' }} />
                    </div>
                    <div className="flex-between" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span>Trạng thái: <strong>{
                        vipImportJob.status === 'pending' ? 'Đang chờ' :
                        vipImportJob.status === 'processing' ? 'Đang xử lý' :
                        vipImportJob.status === 'completed' ? 'Hoàn thành' :
                        vipImportJob.status === 'failed' ? 'Thất bại' : vipImportJob.status
                      }</strong></span>
                      <span>{vipImportJob.importedRows || 0} / {vipImportJob.totalRows || 0} dòng</span>
                    </div>
                  </div>
                )}

                {vipImportJob && vipImportJob.errorLogs && vipImportJob.errorLogs.length > 0 && (
                  <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--danger)', marginBottom: '0.5rem' }}>
                      ⚠️ Nhập danh sách hoàn tất với {vipImportJob.errorLogs.length} dòng bị lỗi.
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <button type="button" className="btn btn-outline btn-sm" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => handleDownloadErrorCsv(vipImportJob)}>
                        Tải file log lỗi (.csv)
                      </button>
                      <button type="button" className="btn btn-outline btn-sm" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => setShowErrorTable(!showErrorTable)}>
                        {showErrorTable ? 'Ẩn chi tiết lỗi' : 'Xem chi tiết lỗi'}
                      </button>
                    </div>
                    {showErrorTable && (
                      <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)', backgroundColor: 'var(--surface)' }}>
                        <table className="data-table" style={{ fontSize: '0.8rem', width: '100%' }}>
                          <thead>
                            <tr>
                              <th>Dòng</th>
                              <th>Email</th>
                              <th>Lý do lỗi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {vipImportJob.errorLogs.map((log, idx) => (
                              <tr key={idx}>
                                <td>{log.row}</td>
                                <td>{log.email || '—'}</td>
                                <td style={{ color: 'var(--danger)' }}>{log.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: '1.5rem' }}>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Danh sách khách mời VIP ({vipGuestsList.length})</h4>
                  {vipGuestsList.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>Chưa có khách mời VIP nào.</p>
                  ) : (
                    <div className="table-wrap" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Họ và tên</th>
                            <th>Email</th>
                            <th>Công ty</th>
                            <th>Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vipGuestsList.map((g) => (
                            <tr key={g.id}>
                              <td style={{ fontWeight: 600 }}>{g.fullName}</td>
                              <td style={{ color: 'var(--text-muted)' }}>{g.email}</td>
                              <td>{g.affiliateCompany || 'N/A'}</td>
                              <td>
                                <span className={`badge ${g.checkinStatus === 'checked_in' ? 'badge-primary' : ''}`}>
                                  {g.checkinStatus === 'checked_in' ? 'Đã check-in' : 'Chưa check-in'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                  <div>
                    {isCreateMode ? (
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                        onClick={handleCloseOrCancel}
                      >
                        Hủy bỏ
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={handleCloseOrCancel}
                      >
                        Đóng
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="button" className="btn btn-outline" onClick={() => setCurrentStep(2)}>
                      Quay lại
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => {
                      setShowForm(false);
                      fetchConcerts();
                    }}>
                      Hoàn tất
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          {/* === Stats Summary Bar === */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1rem',
            marginBottom: '1.75rem',
          }}>
            {[
              { label: 'Tổng sự kiện', value: concerts.length, color: 'var(--primary)', bg: 'rgba(242,63,99,0.06)' },
              { label: 'Đang mở bán', value: concerts.filter(c => c.status === 'active').length, color: 'var(--success)', bg: 'rgba(16,185,129,0.06)' },
              { label: 'Bản nháp', value: concerts.filter(c => c.status === 'draft').length, color: '#d97706', bg: 'rgba(217,119,6,0.06)' },
              { label: 'Đã hủy', value: concerts.filter(c => c.status === 'cancelled').length, color: 'var(--danger)', bg: 'rgba(239,68,68,0.06)' },
            ].map((stat) => (
              <div key={stat.label} style={{
                background: stat.bg,
                border: `1px solid ${stat.color}22`,
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}>
                <span style={{ fontSize: '1.75rem', fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.3 }}>{stat.label}</span>
              </div>
            ))}
          </div>

          {/* === Tab Filter Pills === */}
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1.5rem',
            background: 'var(--surface-alt)',
            borderRadius: '10px',
            padding: '4px',
            width: 'fit-content',
            border: '1px solid var(--border)',
          }}>
            {([['all', 'Tất cả'], ['active', 'Đang bán'], ['draft', 'Bản nháp'], ['cancelled', 'Đã hủy'], ['completed', 'Đã diễn ra']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => {
                  setStatusFilter(val);
                  if (val === 'all') setSearchParams({});
                  else setSearchParams({ status: val });
                }}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: '7px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: statusFilter === val ? 700 : 500,
                  background: statusFilter === val ? 'var(--surface)' : 'transparent',
                  color: statusFilter === val ? 'var(--text-strong)' : 'var(--text-muted)',
                  boxShadow: statusFilter === val ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >{label}</button>
            ))}
          </div>

          {loading ? (
            <div className="flex-center" style={{ padding: '4rem' }}>
              <div className="spinner" />
            </div>
          ) : concerts.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '4rem 2rem',
              background: 'var(--surface)',
              borderRadius: '16px',
              border: '2px dashed var(--border)',
            }}>
              <div style={{
                width: '64px', height: '64px',
                background: 'rgba(242,63,99,0.08)',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.25rem',
              }}>
                <Music2 size={28} style={{ color: 'var(--primary)' }} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Chưa có sự kiện nào</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Bắt đầu bằng cách tạo sự kiện đầu tiên của bạn.</p>
              <button className="btn btn-primary" onClick={handleOpenCreate}>
                <Plus size={16} />
                Tạo sự kiện đầu tiên
              </button>
            </div>
          ) : filteredConcerts.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem 2rem',
              background: 'var(--surface)',
              borderRadius: '16px',
              border: '1px solid var(--border)',
            }}>
              <LayoutList size={36} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                Không có sự kiện nào với trạng thái đã chọn.
              </p>
            </div>
          ) : (
            <div className="concert-grid grid-list">
              {filteredConcerts.map((concert) => {
                const startDate = concert.startTime ? new Date(concert.startTime) : null;
                const dateStr = startDate
                  ? startDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                  : null;
                const timeStr = startDate
                  ? startDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                  : null;

                const statusBadgeClass = concert.status === 'active' ? 'active'
                  : concert.status === 'cancelled' ? 'cancelled'
                  : 'ended';

                const statusLabel = concert.status === 'active' ? 'Mở bán'
                  : concert.status === 'cancelled' ? 'Đã hủy'
                  : concert.status === 'completed' ? 'Đã diễn ra'
                  : 'Bản nháp';

                return (
                  <article key={concert.id} className="card interactive-card concert-card">
                    {/* Poster Cover */}
                    <div className="concert-poster">
                      <span className={`concert-status-badge ${statusBadgeClass}`}>
                        {statusLabel}
                      </span>
                      <img
                        src={concert.posterUrl || heroPreview}
                        alt={concert.title}
                        loading="lazy"
                      />
                      {dateStr && (
                        <div className="concert-poster-date">
                          <CalendarDays size={13} />
                          {dateStr}
                          {timeStr && (
                            <>
                              <span style={{ opacity: 0.55, margin: '0 1px' }}>·</span>
                              {timeStr}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card Body */}
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
                          <MapPin size={14} />
                          {concert.location || '—'}
                        </p>
                      </div>
                      <div className="concert-card-actions">
                        <button
                          className="btn btn-outline"
                          style={{ color: 'var(--danger)', borderColor: 'rgba(220,38,38,0.3)' }}
                          onClick={() => handleDeleteConcert(concert.id)}
                          aria-label={`Xóa ${concert.title}`}
                          title="Xóa"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button
                          className="btn btn-outline"
                          onClick={() => handleOpenEdit(concert)}
                          aria-label={`Chỉnh sửa ${concert.title}`}
                          title="Chỉnh sửa"
                        >
                          <Edit2 size={14} />
                          Chỉnh sửa
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {confirmModal.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(8px)',
        }}>
          <div className="card" style={{
            width: '420px',
            maxWidth: '92%',
            padding: '1.75rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            borderRadius: '16px',
            border: '1px solid var(--border)'
          }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', fontWeight: 700 }}>
              {confirmModal.title}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1.75rem', lineHeight: '1.6' }}>
              {confirmModal.message}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ borderRadius: '8px', padding: '0.6rem 1.2rem', fontWeight: 500 }}
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{
                  borderRadius: '8px',
                  padding: '0.6rem 1.2rem',
                  fontWeight: 500,
                  backgroundColor: 'var(--danger)',
                  color: '#fff',
                  border: 'none'
                }}
                onClick={confirmModal.onConfirm}
              >
                {confirmModal.confirmText || 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSvgZoom && svgStageMap && (
        <div
          onClick={() => setShowSvgZoom(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              backgroundColor: '#fff',
              borderRadius: '16px',
              padding: '1.5rem',
              maxWidth: '90vw',
              maxHeight: '88vh',
              width: '100%',
              overflow: 'auto',
              boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', display: 'flex', alignItems: 'center', gap: '6px' }}><MapIcon size={18} /> Sơ đồ ghế — Xem toàn cảnh</span>
              <button
                onClick={() => setShowSvgZoom(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  background: '#f9fafb',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                  color: '#6b7280',
                }}
                title="Đóng"
              >
                ✕
              </button>
            </div>
            <div
              className="zoom-svg-wrapper"
              style={{ width: '100%', overflow: 'auto', display: 'flex', justifyContent: 'center' }}
              dangerouslySetInnerHTML={{ __html: svgStageMap }}
            />
            <p style={{ textAlign: 'center', fontSize: '0.78rem', color: '#9ca3af', marginTop: '1rem', margin: '1rem 0 0' }}>
              Nhấp bên ngoài hoặc nút ✕ để đóng
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
