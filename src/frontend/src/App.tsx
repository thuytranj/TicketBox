import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Mail,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Ticket,
  UserPlus,
  UserRound,
} from 'lucide-react';
import { AuthProvider } from './features/auth/AuthContext';
import { useAuth } from './features/auth/useAuth';
import { SocketProvider } from './features/socket/SocketContext';
import { ProtectedRoute, AdminRoute } from './components/RouteGuards';
import { apiClient, type ApiError } from './api/client';

import { ConcertList } from './features/concerts/ConcertList';
import { ConcertDetail } from './features/concerts/ConcertDetail';
import { BookingProcess } from './features/booking/BookingProcess';
import { CheckoutPage } from './features/payment/CheckoutPage';
import { PaymentCallback } from './features/payment/PaymentCallback';
import { MyBookings } from './features/booking/MyBookings';
import { AdminLayout } from './features/admin/AdminLayout';
import { AdminDashboard } from './features/admin/AdminDashboard';
import { AdminConcerts } from './features/admin/AdminConcerts';
import { NotificationsPanel } from './features/notifications/NotificationsPanel';

const BrandLogo: React.FC<{ size?: number }> = ({ size = 26 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" width={size} height={size} style={{ verticalAlign: 'middle', borderRadius: '6px', overflow: 'hidden' }}>
    <defs>
      <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ff2d55"/>
        <stop offset="100%" stopColor="#863bff"/>
      </linearGradient>
    </defs>
    <rect x="10" y="10" width="80" height="80" rx="22" fill="url(#logoGrad)"/>
    <path d="M35 48V25c0-2 1.5-3.5 3.5-3.5h23c2 0 3.5 1.5 3.5 3.5v23c-3 0-5 2-5 5s2 5 5 5v12c0 2-1.5 3.5-3.5 3.5h-23c-2 0-3.5-1.5-3.5-3.5v-12c3 0 5-2 5-5s-2-5-5-5z" fill="#ffffff"/>
    <circle cx="50" cy="35" r="4.5" fill="url(#logoGrad)"/>
    <line x1="43" y1="53" x2="57" y2="53" stroke="url(#logoGrad)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="3 3"/>
  </svg>
);

const NavigationHeader: React.FC = () => {
  const { user, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <Link to="/" className="brand-link">
            <BrandLogo />
            <span>TicketBox</span>
          </Link>

          <nav className="site-nav" aria-label="Điều hướng chính">
            <Link to="/concerts" className="nav-link">Sự kiện</Link>
            {user && user.role !== 'organizer' && (
              <Link to="/my-bookings" className="nav-link">Vé của tôi</Link>
            )}
            {user?.role === 'organizer' && (
              <Link to="/admin" className="nav-link">Quản trị</Link>
            )}
          </nav>

          <div className="site-actions">
            {user ? (
              <>
                <NotificationsPanel />
                <span className="user-chip">
                  <UserRound size={18} />
                  <strong>{user.fullName || user.email}</strong>
                </span>
                <button onClick={() => setShowLogoutConfirm(true)} className="btn btn-outline">
                  <LogOut size={18} />
                  Đăng xuất
                </button>
              </>
            ) : (
              <Link to="/login" className="btn btn-primary">
                <Ticket size={18} />
                Đăng nhập
              </Link>
            )}
          </div>
        </div>
      </header>

      {showLogoutConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)',
        }}>
          <div className="card" style={{
            width: '380px',
            maxWidth: '90%',
            padding: '1.75rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            borderRadius: '16px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
          }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', fontWeight: 700, color: 'var(--text-strong)' }}>
              Xác nhận đăng xuất
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1.75rem', lineHeight: '1.6' }}>
              Bạn có chắc chắn muốn đăng xuất khỏi hệ thống TicketBox không?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ borderRadius: '8px', padding: '0.6rem 1.2rem', fontWeight: 500 }}
                onClick={() => setShowLogoutConfirm(false)}
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
                  border: 'none',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setShowLogoutConfirm(false);
                  void logout();
                }}
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="page-shell">
    <NavigationHeader />
    <main className="public-main">{children}</main>
  </div>
);

type AuthMode = 'login' | 'register' | 'verify' | 'forgot' | 'resetOtp' | 'resetPassword';

const getAuthErrorMessage = (error: unknown) => {
  const apiError = error as Partial<ApiError>;
  if (Array.isArray(apiError.message)) {
    return apiError.message.join('. ');
  }
  if (typeof apiError.message === 'string') {
    return apiError.message;
  }
  return 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
};

const LoginScreen: React.FC = () => {
  const { login, user } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const trimmedEmail = email.trim().toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      if (mode === 'login') {
        const tokens = await apiClient.request<{ accessToken: string; refreshToken: string }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: trimmedEmail, password }),
        });
        await login(tokens.accessToken, tokens.refreshToken);
        return;
      }

      if (mode === 'register') {
        await apiClient.request('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ email: trimmedEmail, password, fullName: fullName.trim() }),
        });
        setMode('verify');
        setPassword('');
        setMessage('Mã OTP đã được gửi tới email của bạn.');
        return;
      }

      if (mode === 'verify') {
        await apiClient.request('/auth/verify-otp', {
          method: 'POST',
          body: JSON.stringify({ email: trimmedEmail, otp }),
        });
        setMode('login');
        setOtp('');
        setMessage('Tài khoản đã được kích hoạt. Bạn có thể đăng nhập ngay.');
        return;
      }

      if (mode === 'forgot') {
        await apiClient.request('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email: trimmedEmail }),
        });
        setMode('resetOtp');
        setMessage('Mã OTP đặt lại mật khẩu đã được gửi.');
        return;
      }

      if (mode === 'resetOtp') {
        const result = await apiClient.request<{ resetToken: string }>('/auth/verify-reset-otp', {
          method: 'POST',
          body: JSON.stringify({ email: trimmedEmail, otp }),
        });
        setResetToken(result.resetToken);
        setOtp('');
        setMode('resetPassword');
        return;
      }

      if (mode === 'resetPassword') {
        if (newPassword !== confirmPassword) {
          setError('Mật khẩu xác nhận chưa khớp.');
          return;
        }

        await apiClient.request('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ email: trimmedEmail, resetToken, newPassword }),
        });
        setPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setResetToken('');
        setMode('login');
        setMessage('Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại.');
      }
    } catch (err) {
      const nextMessage = getAuthErrorMessage(err);
      if (mode === 'login' && (err as ApiError).statusCode === 403) {
        setMode('verify');
      }
      setError(nextMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setMessage('');
    setResending(true);
    try {
      await apiClient.request('/auth/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ email: trimmedEmail }),
      });
      setMessage('Mã OTP mới đã được gửi.');
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError('');
    setMessage('');
  };

  const from = (location.state as any)?.from || (user?.role === 'organizer' ? '/admin' : '/concerts');

  if (user) {
    return <Navigate to={from} replace />;
  }

  const isOtpMode = mode === 'verify' || mode === 'resetOtp';
  const isResetPasswordMode = mode === 'resetPassword';
  const primaryText = {
    login: 'Đăng nhập',
    register: 'Tạo tài khoản',
    verify: 'Xác thực OTP',
    forgot: 'Gửi mã OTP',
    resetOtp: 'Xác nhận OTP',
    resetPassword: 'Đổi mật khẩu',
  }[mode];

  return (
    <div className="auth-page">
      <section className="auth-hero" aria-label="TicketBox">
        <span className="brand-mark">TB</span>
        <h1>TicketBox</h1>
        <p>Khám phá ngàn sự kiện hot nhất và đặt vé nhanh chóng chỉ trong vài bước.</p>
        <div className="auth-highlights" aria-label="Điểm nổi bật">
          <span><Ticket size={18} /> Đặt vé nhanh</span>
          <span><ShieldCheck size={18} /> Phiên đăng nhập an toàn</span>
          <span><KeyRound size={18} /> OTP qua email</span>
        </div>
      </section>

      <section className="auth-panel card" aria-label="Tài khoản TicketBox">
        <div className="card-body">
          {(mode === 'login' || mode === 'register') && (
            <div className="auth-tabs" role="tablist" aria-label="Chọn thao tác tài khoản">
              <button
                type="button"
                className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
                onClick={() => switchMode('login')}
              >
                <LogIn size={17} />
                Đăng nhập
              </button>
              <button
                type="button"
                className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
                onClick={() => switchMode('register')}
              >
                <UserPlus size={17} />
                Đăng ký
              </button>
            </div>
          )}

          {mode !== 'login' && mode !== 'register' && (
            <button type="button" className="btn btn-ghost auth-back" onClick={() => switchMode('login')}>
              <ArrowLeft size={18} />
              Quay lại đăng nhập
            </button>
          )}

          <div className="auth-heading">
            <h2>
              {mode === 'login' && 'Chào mừng trở lại'}
              {mode === 'register' && 'Tạo tài khoản khán giả'}
              {mode === 'verify' && 'Xác thực email'}
              {mode === 'forgot' && 'Quên mật khẩu'}
              {mode === 'resetOtp' && 'Nhập mã OTP'}
              {mode === 'resetPassword' && 'Tạo mật khẩu mới'}
            </h2>
            <p>
              {mode === 'login' && 'Dùng email và mật khẩu đã kích hoạt để vào TicketBox.'}
              {mode === 'register' && 'Tài khoản mới cần xác thực OTP trước khi đăng nhập.'}
              {mode === 'verify' && 'Mã gồm 6 chữ số và có hiệu lực trong vài phút.'}
              {mode === 'forgot' && 'Nhập email đang hoạt động để nhận mã đặt lại mật khẩu.'}
              {mode === 'resetOtp' && 'Xác nhận mã trong email để tiếp tục.'}
              {mode === 'resetPassword' && 'Mật khẩu mới cần tối thiểu 6 ký tự.'}
            </p>
          </div>

          {message && <div className="alert alert-success" role="status">{message}</div>}
          {error && <div className="alert alert-danger" role="alert">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'register' && (
              <div className="form-group">
                <label htmlFor="auth-name" className="form-label">Họ và tên</label>
                <div className="input-with-icon">
                  <UserRound size={18} />
                  <input
                    id="auth-name"
                    type="text"
                    className="form-control"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nguyen Van A"
                    autoComplete="name"
                    required
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="auth-email" className="form-label">Email</label>
              <div className="input-with-icon">
                <Mail size={18} />
                <input
                  id="auth-email"
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {(mode === 'login' || mode === 'register') && (
              <div className="form-group">
                <label htmlFor="auth-password" className="form-label">Mật khẩu</label>
                <div className="input-with-icon">
                  <Lock size={18} />
                  <input
                    id="auth-password"
                    type="password"
                    className="form-control"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    minLength={6}
                    required
                  />
                </div>
              </div>
            )}

            {isOtpMode && (
              <div className="form-group">
                <label htmlFor="auth-otp" className="form-label">Mã OTP</label>
                <div className="input-with-icon">
                  <KeyRound size={18} />
                  <input
                    id="auth-otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    className="form-control"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    required
                  />
                </div>
              </div>
            )}

            {isResetPasswordMode && (
              <>
                <div className="form-group">
                  <label htmlFor="auth-new-password" className="form-label">Mật khẩu mới</label>
                  <div className="input-with-icon">
                    <Lock size={18} />
                    <input
                      id="auth-new-password"
                      type="password"
                      className="form-control"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Tối thiểu 6 ký tự"
                      autoComplete="new-password"
                      minLength={6}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="auth-confirm-password" className="form-label">Xác nhận mật khẩu</label>
                  <div className="input-with-icon">
                    <Lock size={18} />
                    <input
                      id="auth-confirm-password"
                      type="password"
                      className="form-control"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu"
                      autoComplete="new-password"
                      minLength={6}
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
              {submitting ? <Loader2 size={18} className="spin-icon" /> : <ShieldCheck size={18} />}
              {primaryText}
            </button>

            {mode === 'login' && (
              <button type="button" className="btn btn-ghost auth-link-button" onClick={() => switchMode('forgot')}>
                <KeyRound size={17} />
                Quên mật khẩu
              </button>
            )}

            {mode === 'verify' && (
              <button
                type="button"
                className="btn btn-outline auth-link-button"
                onClick={() => void handleResendOtp()}
                disabled={resending || !trimmedEmail}
              >
                {resending ? <Loader2 size={17} className="spin-icon" /> : <RotateCcw size={17} />}
                Gửi lại OTP
              </button>
            )}
          </form>
        </div>
      </section>
    </div>
  );
};

const UnauthorizedPage: React.FC = () => (
  <div className="state-card card">
    <div className="card-body">
      <div className="state-icon danger" aria-hidden="true">
        <ShieldAlert size={28} />
      </div>
      <h2 style={{ color: 'var(--danger)', marginBottom: 12 }}>Không có quyền truy cập</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
        Khu quản trị chỉ dành cho vai trò Ban tổ chức. Bạn có thể đổi tài khoản hoặc quay lại trang sự kiện.
      </p>
      <div className="state-actions">
        <Link to="/login" className="btn btn-outline">Đổi tài khoản</Link>
        <Link to="/" className="btn btn-primary">Về trang sự kiện</Link>
      </div>
    </div>
  </div>
);

const AppContent: React.FC = () => (
  <Routes>
    <Route path="/" element={<PublicLayout><ConcertList /></PublicLayout>} />
    <Route path="/concerts" element={<PublicLayout><ConcertList /></PublicLayout>} />
    <Route path="/concerts/:id" element={<PublicLayout><ConcertDetail /></PublicLayout>} />
    <Route path="/login" element={<PublicLayout><LoginScreen /></PublicLayout>} />

    <Route path="/bookings/processing/:orderId" element={<ProtectedRoute><PublicLayout><BookingProcess /></PublicLayout></ProtectedRoute>} />
    <Route path="/checkout/:orderId" element={<ProtectedRoute><PublicLayout><CheckoutPage /></PublicLayout></ProtectedRoute>} />
    <Route path="/payment-callback/:orderId" element={<ProtectedRoute><PublicLayout><PaymentCallback /></PublicLayout></ProtectedRoute>} />
    <Route path="/payment/callback/momo" element={<ProtectedRoute><PublicLayout><PaymentCallback /></PublicLayout></ProtectedRoute>} />
    <Route path="/payment/callback/vnpay" element={<ProtectedRoute><PublicLayout><PaymentCallback /></PublicLayout></ProtectedRoute>} />
    <Route path="/my-bookings" element={<ProtectedRoute><PublicLayout><MyBookings /></PublicLayout></ProtectedRoute>} />

    <Route path="/admin" element={<AdminRoute><AdminLayout><AdminDashboard /></AdminLayout></AdminRoute>} />
    <Route path="/admin/concerts" element={<AdminRoute><AdminLayout><AdminConcerts /></AdminLayout></AdminRoute>} />

    <Route path="/unauthorized" element={<PublicLayout><UnauthorizedPage /></PublicLayout>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <AppContent />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
