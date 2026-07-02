import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useSocket } from '../socket/SocketContext';
import { ArrowRight, Bell, CalendarClock, Check, MailOpen, Sparkles, TicketCheck, TriangleAlert } from 'lucide-react';

export interface NotificationLog {
  id: number;
  userId: string;
  type: string;
  title: string;
  body: string;
  channel: 'in_app' | 'email';
  status: 'unread' | 'read';
  referenceId: string | null;
  readAt: string | null;
  createdAt: string;
}

const getNotificationMeta = (notification: NotificationLog) => {
  switch (notification.type) {
    case 'booking_confirmed':
      return {
        label: 'Booking',
        icon: <TicketCheck size={12} />,
        actionLabel: 'View booking',
        to: notification.referenceId ? `/payment-callback/${notification.referenceId}` : null,
      };
    case 'concert_reminder':
      return {
        label: 'Reminder',
        icon: <CalendarClock size={12} />,
        actionLabel: 'View concert',
        to: notification.referenceId ? `/concerts/${notification.referenceId}` : null,
      };
    case 'ai_bio_completed':
      return {
        label: 'AI Bio',
        icon: <Sparkles size={12} />,
        actionLabel: 'Review bio',
        to: notification.referenceId ? `/admin/concerts/${notification.referenceId}/bio` : null,
      };
    case 'ai_bio_failed':
      return {
        label: 'AI Bio',
        icon: <TriangleAlert size={12} />,
        actionLabel: 'Review bio',
        to: notification.referenceId ? `/admin/concerts/${notification.referenceId}/bio` : null,
      };
    default:
      return {
        label: 'Update',
        icon: <Bell size={12} />,
        actionLabel: null,
        to: null,
      };
  }
};

export const NotificationsPanel: React.FC = () => {
  const { socket } = useSocket();
  
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await apiClient.request<{ data: NotificationLog[] }>('/notifications?page=1&limit=20');
      const items = res.data || [];
      setNotifications(items);
      const unread = items.filter((n) => n.status === 'unread').length;
      setUnreadCount(unread);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Listen for real-time notifications
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notification: NotificationLog) => {
      setNotifications((prev) => [notification, ...prev]);
      if (notification.status === 'unread') {
        setUnreadCount((c) => c + 1);
      }
    };

    socket.on('notification_received', handleNewNotification);

    return () => {
      socket.off('notification_received', handleNewNotification);
    };
  }, [socket]);

  // Click outside to close handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await apiClient.request(`/notifications/${id}/read`, {
        method: 'PATCH',
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: 'read' as const } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiClient.request('/notifications/read-all', {
        method: 'PATCH',
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, status: 'read' as const })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  return (
    <div ref={panelRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Bell Button */}
      <button
        aria-label="Toggle notifications"
        onClick={handleToggle}
        className="btn btn-outline icon-button"
        style={{
          borderRadius: '50%',
          position: 'relative',
        }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            aria-label="Unread count"
            style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              fontSize: '0.7rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--surface)',
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          role="region"
          aria-label="Notifications list"
          className="card notification-popover"
        >
          {/* Header */}
          <div
            className="flex-between"
            style={{
              padding: '1rem',
              borderBottom: '1px solid var(--border)',
              backgroundColor: 'var(--surface-alt)',
            }}
          >
            <h3 style={{ fontSize: '1rem', margin: 0, fontWeight: 600 }}>Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="btn"
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  backgroundColor: 'transparent',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <MailOpen size={14} /> Mark all read
              </button>
            )}
          </div>

          {/* List Content */}
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '350px' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No notifications found.
              </div>
            ) : (
              notifications.map((n) => {
                const meta = getNotificationMeta(n);

                return (
                  <div
                    key={n.id}
                    onClick={() => n.status === 'unread' && handleMarkAsRead(n.id)}
                    className={`notification-item ${n.status === 'unread' ? 'unread' : ''}`}
                  >
                    {/* Indicator Dot */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', paddingTop: '0.25rem' }}>
                      {n.status === 'unread' ? (
                        <div className="notification-dot" />
                      ) : (
                        <div style={{ width: '8px' }} />
                      )}
                    </div>

                    {/* Body Text */}
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '999px',
                          backgroundColor: 'var(--surface-alt)',
                          color: 'var(--primary)',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          marginBottom: '0.45rem',
                        }}
                      >
                        {meta.icon}
                        <span>{meta.label}</span>
                      </div>
                      <div
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: n.status === 'unread' ? 600 : 500,
                          color: 'var(--text-strong)',
                          marginBottom: '0.25rem',
                        }}
                      >
                        {n.title}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                        {n.body}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: meta.to ? '0.5rem' : 0 }}>
                        {new Date(n.createdAt).toLocaleString()}
                      </div>
                      {meta.to && meta.actionLabel && (
                        <Link
                          to={meta.to}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            color: 'var(--primary)',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            textDecoration: 'none',
                          }}
                        >
                          {meta.actionLabel}
                          <ArrowRight size={13} />
                        </Link>
                      )}
                    </div>

                    {/* Single mark as read button */}
                    {n.status === 'unread' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsRead(n.id);
                        }}
                        aria-label="Mark as read"
                        className="btn"
                        style={{
                          padding: '0.25rem',
                          backgroundColor: 'transparent',
                          color: 'var(--text-muted)',
                          alignSelf: 'center',
                        }}
                      >
                        <Check size={16} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
