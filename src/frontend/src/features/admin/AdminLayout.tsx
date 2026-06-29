import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Music } from 'lucide-react';
import { NotificationsPanel } from '../notifications/NotificationsPanel';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const location = useLocation();

  const isLinkActive = (path: string) => location.pathname === path;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <Link to="/admin" className="brand-link">
            <span className="brand-mark">TB</span>
            <span>Organizer</span>
          </Link>
        </div>

        <nav className="admin-nav" aria-label="Organizer navigation">
          <Link to="/admin" className={`admin-nav-link ${isLinkActive('/admin') ? 'active' : ''}`}>
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </Link>

          <Link to="/admin/concerts" className={`admin-nav-link ${isLinkActive('/admin/concerts') ? 'active' : ''}`}>
            <Music size={20} />
            <span>Concerts</span>
          </Link>
        </nav>

        <div className="admin-footer">TicketBox Admin</div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <Link to="/" className="btn btn-outline">
            View Main Site
          </Link>
          <NotificationsPanel />
        </header>

        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
};
