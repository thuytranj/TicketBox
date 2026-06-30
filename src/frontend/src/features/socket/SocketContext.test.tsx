import { render, screen, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { SocketProvider, useSocket } from './SocketContext';
import { io } from 'socket.io-client';
import { useAuth } from '../auth/useAuth';

vi.mock('socket.io-client', () => {
  const mockSocket = {
    on: vi.fn(),
    off: vi.fn(),
    close: vi.fn(),
  };
  return {
    io: vi.fn(() => mockSocket),
  };
});

vi.mock('../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

const TestComponent = () => {
  const { connected } = useSocket();
  return <div>{connected ? 'CONNECTED' : 'DISCONNECTED'}</div>;
};

describe('SocketContext', () => {
  let socketOnCallbacks: Record<string, Function> = {};
  let mockSocketInstance: any;

  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
    localStorage.clear();
    socketOnCallbacks = {};

    mockSocketInstance = {
      on: vi.fn((event, callback) => {
        socketOnCallbacks[event] = callback;
      }),
      close: vi.fn(),
    };
    vi.mocked(io).mockReturnValue(mockSocketInstance);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('does not connect when there is no authenticated user', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false } as any);

    render(
      <SocketProvider>
        <TestComponent />
      </SocketProvider>
    );

    expect(io).not.toHaveBeenCalled();
    expect(screen.getByText('DISCONNECTED')).toBeInTheDocument();
  });

  it('connects to backend passing the token when user is logged in', () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'u1', role: 'organizer' }, loading: false } as any);
    localStorage.setItem('accessToken', 'mock_jwt_token');

    render(
      <SocketProvider>
        <TestComponent />
      </SocketProvider>
    );

    expect(io).toHaveBeenCalledWith('http://localhost:3000', expect.objectContaining({
      auth: { token: 'mock_jwt_token' },
    }));
  });

  it('uses VITE_SOCKET_URL when configured', () => {
    vi.stubEnv('VITE_SOCKET_URL', 'http://ticketbox.test:4000');
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'u1', role: 'organizer' }, loading: false } as any);
    localStorage.setItem('accessToken', 'mock_jwt_token');

    render(
      <SocketProvider>
        <TestComponent />
      </SocketProvider>
    );

    expect(io).toHaveBeenCalledWith('http://ticketbox.test:4000', expect.objectContaining({
      auth: { token: 'mock_jwt_token' },
    }));
  });

  it('updates connection state when connection events fire', () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'u1', role: 'organizer' }, loading: false } as any);
    localStorage.setItem('accessToken', 'mock_jwt_token');

    render(
      <SocketProvider>
        <TestComponent />
      </SocketProvider>
    );

    expect(screen.getByText('DISCONNECTED')).toBeInTheDocument();

    // Trigger connect callback
    act(() => {
      if (socketOnCallbacks['connect']) {
        socketOnCallbacks['connect']();
      }
    });
    expect(screen.getByText('CONNECTED')).toBeInTheDocument();

    // Trigger disconnect callback
    act(() => {
      if (socketOnCallbacks['disconnect']) {
        socketOnCallbacks['disconnect']();
      }
    });
    expect(screen.getByText('DISCONNECTED')).toBeInTheDocument();
  });

  it('disconnects and closes the socket connection on unmount', () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'u1', role: 'organizer' }, loading: false } as any);
    localStorage.setItem('accessToken', 'mock_jwt_token');

    const { unmount } = render(
      <SocketProvider>
        <TestComponent />
      </SocketProvider>
    );

    unmount();
    expect(mockSocketInstance.close).toHaveBeenCalled();
  });
});
