import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, LogOut, Music, Menu, X } from 'lucide-react';
import { NotificationsPanel } from '../notifications/NotificationsPanel';
import { useAuth } from '../auth/useAuth';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const location = useLocation();
  const { logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isLinkActive = (path: string) => location.pathname === path;

  return (
    <div className="admin-shell">
      {isMobileMenuOpen && (
        <div className="admin-backdrop" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <aside className={`admin-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="admin-brand" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <Link to="/admin" className="brand-link" style={{ flex: 1 }}>
            <span className="brand-mark">TB</span>
            <span>Ban tổ chức</span>
          </Link>
          <button
            type="button"
            className="admin-menu-close"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Đóng menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="admin-nav" aria-label="Organizer navigation">
          <Link to="/admin" className={`admin-nav-link ${isLinkActive('/admin') ? 'active' : ''}`} onClick={() => setIsMobileMenuOpen(false)}>
            <LayoutDashboard size={20} />
            <span>Tổng quan</span>
          </Link>

          <Link to="/admin/concerts" className={`admin-nav-link ${isLinkActive('/admin/concerts') ? 'active' : ''}`} onClick={() => setIsMobileMenuOpen(false)}>
            <Music size={20} />
            <span>Sự kiện</span>
          </Link>
        </nav>

        <div className="admin-footer">TicketBox Quản trị</div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-menu-toggle"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Mở menu"
          >
            <Menu size={24} />
          </button>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginLeft: 'auto' }}>
            <Link to="/" className="btn btn-outline">
              Xem trang khách
            </Link>
            <button type="button" className="btn btn-outline" onClick={() => void logout()}>
              <LogOut size={17} />
              Đăng xuất
            </button>
            <NotificationsPanel />
          </div>
        </header>

        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
};
