import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from './client';

describe('ApiClient', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('attaches authorization header if token exists', async () => {
    localStorage.setItem('accessToken', 'test-token');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: 'success' }),
    });
    global.fetch = mockFetch;

    const result = await apiClient.request('/test');
    expect(result).toEqual({ data: 'success' });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    );
    
    const sentHeaders = mockFetch.mock.calls[0][1].headers as Headers;
    expect(sentHeaders.get('Authorization')).toBe('Bearer test-token');
  });

  it('handles token refreshing on 401 status', async () => {
    localStorage.setItem('accessToken', 'old-access-token');
    localStorage.setItem('refreshToken', 'old-refresh-token');

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        status: 401,
        ok: false,
        json: async () => ({ message: 'Unauthorized' }),
      }) // First request fails
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token' }),
      }) // Refresh call succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'retry-success' }),
      }); // Retry succeeds

    global.fetch = mockFetch;

    const result = await apiClient.request('/test');
    expect(result).toEqual({ data: 'retry-success' });
    expect(localStorage.getItem('accessToken')).toBe('new-access-token');
  });

  it('keeps demo sessions when an API request returns 401', async () => {
    localStorage.setItem('accessToken', 'mock-access-token');
    localStorage.setItem('refreshToken', 'mock-refresh-token');
    localStorage.setItem(
      'demoUser',
      JSON.stringify({ id: 'demo-organizer', email: 'demo@example.com', fullName: 'Demo User', role: 'organizer' })
    );
    const logoutListener = vi.fn();
    window.addEventListener('auth-logout', logoutListener);

    const mockFetch = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({ message: 'Unauthorized' }),
    });
    global.fetch = mockFetch;

    await expect(apiClient.request('/admin-only')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Unauthorized',
    });

    expect(localStorage.getItem('accessToken')).toBe('mock-access-token');
    expect(localStorage.getItem('demoUser')).toContain('Demo User');
    expect(logoutListener).not.toHaveBeenCalled();

    window.removeEventListener('auth-logout', logoutListener);
  });
});
