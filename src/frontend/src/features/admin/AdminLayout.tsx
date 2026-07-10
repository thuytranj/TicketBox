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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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
            <button type="button" className="btn btn-outline" onClick={() => setShowLogoutConfirm(true)}>
              <LogOut size={17} />
              Đăng xuất
            </button>
            <NotificationsPanel />
          </div>
        </header>

        <div className="admin-content">{children}</div>
      </main>

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
              Bạn có chắc chắn muốn đăng xuất khỏi trang quản trị TicketBox không?
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
    </div>
  );
};
