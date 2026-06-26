import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { LogOut, Ticket, UserRound } from 'lucide-react';
import { AuthProvider, useAuth, type User } from './features/auth/AuthContext';
import { SocketProvider } from './features/socket/SocketContext';
import { ProtectedRoute, AdminRoute } from './components/RouteGuards';

import { ConcertList } from './features/concerts/ConcertList';
import { ConcertDetail } from './features/concerts/ConcertDetail';
import { BookingProcess } from './features/booking/BookingProcess';
import { CheckoutPage } from './features/payment/CheckoutPage';
import { PaymentCallback } from './features/payment/PaymentCallback';
import { AdminLayout } from './features/admin/AdminLayout';
import { AdminDashboard } from './features/admin/AdminDashboard';
import { AdminConcerts } from './features/admin/AdminConcerts';
import { AiBiography } from './features/admin/AiBiography';
import { VipGuests } from './features/admin/VipGuests';

const NavigationHeader: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="brand-link">
          <span className="brand-mark">TB</span>
          <span>TicketBox</span>
        </Link>

        <nav className="site-nav" aria-label="Primary navigation">
          <Link to="/concerts" className="nav-link">Concerts</Link>
          {user?.role === 'organizer' && (
            <Link to="/admin" className="nav-link">Organizer Portal</Link>
          )}
        </nav>

        <div className="site-actions">
          {user ? (
            <>
              <span className="user-chip">
                <UserRound size={18} />
                <strong>{user.fullName}</strong>
              </span>
              <button onClick={logout} className="btn btn-outline">
                <LogOut size={18} />
                Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary">
              <Ticket size={18} />
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="page-shell">
    <NavigationHeader />
    <main className="public-main">{children}</main>
  </div>
);

const LoginScreen: React.FC = () => {
  const { login, user } = useAuth();
  const [email, setEmail] = useState('organizer@ticketboxz.me');
  const [role, setRole] = useState<'audience' | 'organizer' | 'gate_staff'>('organizer');
  const [fullName, setFullName] = useState('John Organizer');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const demoUser: User = {
      id: `demo-${role}`,
      email,
      fullName: fullName.trim() || email,
      role,
    };
    localStorage.setItem('accessToken', 'mock-access-token');
    localStorage.setItem('refreshToken', 'mock-refresh-token');
    await login('mock-access-token', 'mock-refresh-token', demoUser);
  };

  if (user) {
    return <Navigate to={user.role === 'organizer' ? '/admin' : '/concerts'} replace />;
  }

  return (
    <div className="container-narrow">
      <div className="card state-card">
        <div className="card-body">
          <span className="brand-mark" style={{ margin: '0 auto 18px' }}>TB</span>
          <h2 style={{ marginBottom: 8 }}>Login to TicketBox</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 28 }}>
            Choose a demo role to enter the ticketing flow or organizer workspace.
          </p>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="login-name" className="form-label">Full Name</label>
              <input
                id="login-name"
                type="text"
                className="form-control"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="login-email" className="form-label">Email Address</label>
              <input
                id="login-email"
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="login-role" className="form-label">Role</label>
              <select
                id="login-role"
                className="form-control"
                value={role}
                onChange={(e: any) => setRole(e.target.value)}
              >
                <option value="organizer">Organizer (Admin)</option>
                <option value="audience">Audience</option>
                <option value="gate_staff">Gate Staff</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>
              Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const UnauthorizedPage: React.FC = () => (
  <div className="state-card card">
    <div className="card-body">
      <h2 style={{ color: 'var(--danger)', marginBottom: 12 }}>Unauthorized Access</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
        You do not have organizer permissions to access the admin portal.
      </p>
      <Link to="/" className="btn btn-primary">Go to Home</Link>
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

    <Route path="/admin" element={<AdminRoute><AdminLayout><AdminDashboard /></AdminLayout></AdminRoute>} />
    <Route path="/admin/concerts" element={<AdminRoute><AdminLayout><AdminConcerts /></AdminLayout></AdminRoute>} />
    <Route path="/admin/concerts/:id/guests" element={<AdminRoute><AdminLayout><VipGuests /></AdminLayout></AdminRoute>} />
    <Route path="/admin/concerts/:id/bio" element={<AdminRoute><AdminLayout><AiBiography /></AdminLayout></AdminRoute>} />

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
