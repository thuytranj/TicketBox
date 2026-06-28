import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { NotificationsPanel } from './NotificationsPanel';
import { apiClient } from '../../api/client';
import { useSocket } from '../socket/SocketContext';

vi.mock('../../api/client', () => ({
  apiClient: {
    request: vi.fn(),
  },
}));

vi.mock('../socket/SocketContext', () => ({
  useSocket: vi.fn(),
}));

describe('NotificationsPanel', () => {
  const mockSocket = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };

  beforeEach(() => {
    cleanup();
    vi.resetAllMocks();
    vi.mocked(useSocket).mockReturnValue({ socket: mockSocket as any, connected: true });
  });

  const mockNotifications = [
    {
      id: 1,
      userId: 'user123',
      type: 'ai_bio_completed',
      title: 'Biography generated',
      body: 'Review bio for Em Xinh Say Hi',
      channel: 'in_app' as const,
      status: 'unread' as const,
      referenceId: 'c1',
      readAt: null,
      createdAt: '2026-06-25T11:00:00Z',
    },
    {
      id: 2,
      userId: 'user123',
      type: 'booking_confirmed',
      title: 'Booking confirmed',
      body: 'Order ORD123 paid.',
      channel: 'in_app' as const,
      status: 'read' as const,
      referenceId: 'b1',
      readAt: '2026-06-25T11:15:00Z',
      createdAt: '2026-06-25T10:00:00Z',
    },
  ];

  it('renders unread badge indicator count correctly', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue({
      data: mockNotifications,
    });

    render(<NotificationsPanel />);

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument(); // 1 unread notification
    });
  });

  it('toggles dropdown on click and displays notification text', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue({
      data: mockNotifications,
    });

    render(<NotificationsPanel />);

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    const toggleButton = screen.getByRole('button', { name: /Toggle notifications/i });
    fireEvent.click(toggleButton);

    expect(screen.getByRole('region')).toBeInTheDocument();
    expect(screen.getByText('Biography generated')).toBeInTheDocument();
    expect(screen.getByText('Review bio for Em Xinh Say Hi')).toBeInTheDocument();
    expect(screen.getByText('Booking confirmed')).toBeInTheDocument();
  });

  it('triggers patch request when marking a single notification as read', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(async (url) => {
      if (url.startsWith('/notifications') && url.includes('limit')) {
        return { data: mockNotifications };
      }
      if (url === '/notifications/1/read') {
        return { success: true };
      }
      return {};
    });

    render(<NotificationsPanel />);

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    // Open Dropdown
    fireEvent.click(screen.getByRole('button', { name: /Toggle notifications/i }));

    // Click mark as read check button
    const markReadBtn = screen.getByRole('button', { name: /Mark as read/i });
    fireEvent.click(markReadBtn);

    await waitFor(() => {
      expect(apiClient.request).toHaveBeenCalledWith(
        '/notifications/1/read',
        expect.objectContaining({ method: 'PATCH' })
      );
      // Badge count should decrease to 0, which removes the indicator
      expect(screen.queryByText('1')).not.toBeInTheDocument();
    });
  });

  it('triggers read-all patch request when clicking mark all read', async () => {
    vi.spyOn(apiClient, 'request').mockImplementation(async (url) => {
      if (url.startsWith('/notifications') && url.includes('limit')) {
        return { data: mockNotifications };
      }
      if (url === '/notifications/read-all') {
        return { success: true };
      }
      return {};
    });

    render(<NotificationsPanel />);

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Toggle notifications/i }));

    const markAllBtn = screen.getByRole('button', { name: /Mark all read/i });
    fireEvent.click(markAllBtn);

    await waitFor(() => {
      expect(apiClient.request).toHaveBeenCalledWith(
        '/notifications/read-all',
        expect.objectContaining({ method: 'PATCH' })
      );
      expect(screen.queryByText('1')).not.toBeInTheDocument();
    });
  });

  it('updates unread count and appends new items when socket receives a notification', async () => {
    let socketCallback: ((data: any) => void) | null = null;
    mockSocket.on.mockImplementation((event, cb) => {
      if (event === 'notification_received') {
        socketCallback = cb;
      }
    });

    vi.spyOn(apiClient, 'request').mockResolvedValue({
      data: [],
    });

    render(<NotificationsPanel />);

    await waitFor(() => {
      expect(screen.queryByText('1')).not.toBeInTheDocument(); // No notifications initially
    });

    // Simulate new unread notification arriving via socket
    if (socketCallback) {
      act(() => {
        (socketCallback as any)({
          id: 3,
          userId: 'user123',
          type: 'ai_bio_failed',
          title: 'Bio generation failed',
          body: 'Parser error.',
          channel: 'in_app',
          status: 'unread',
          referenceId: 'c1',
          readAt: null,
          createdAt: new Date().toISOString(),
        });
      });
    }

    await waitFor(() => {
      // Badge should show 1 unread notification
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    // Open dropdown and assert new item is displayed
    fireEvent.click(screen.getByRole('button', { name: /Toggle notifications/i }));
    expect(screen.getByText('Bio generation failed')).toBeInTheDocument();
  });
});
