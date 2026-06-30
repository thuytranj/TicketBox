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
      json: async () => ({
        success: true,
        statusCode: 200,
        message: 'Request processed successfully',
        data: 'success',
        timestamp: '2026-06-28T00:00:00.000Z',
      }),
    });
    global.fetch = mockFetch;

    const result = await apiClient.request('/test');
    expect(result).toBe('success');
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
        json: async () => ({
          success: true,
          statusCode: 200,
          message: 'Request processed successfully',
          data: { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' },
          timestamp: '2026-06-28T00:00:00.000Z',
        }),
      }) // Refresh call succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          statusCode: 200,
          message: 'Request processed successfully',
          data: 'retry-success',
          timestamp: '2026-06-28T00:00:00.000Z',
        }),
      }); // Retry succeeds

    global.fetch = mockFetch;

    const result = await apiClient.request('/test');
    expect(result).toBe('retry-success');
    expect(localStorage.getItem('accessToken')).toBe('new-access-token');
  });

  it('clears tokens and notifies the app when refresh fails after a 401', async () => {
    localStorage.setItem('accessToken', 'old-access-token');
    localStorage.setItem('refreshToken', 'old-refresh-token');
    const logoutListener = vi.fn();
    window.addEventListener('auth-logout', logoutListener);

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        status: 401,
        ok: false,
        json: async () => ({ message: 'Unauthorized' }),
      })
      .mockResolvedValueOnce({
        status: 401,
        ok: false,
        json: async () => ({ message: 'Invalid refresh token' }),
      });
    global.fetch = mockFetch;

    await expect(apiClient.request('/admin-only')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Session expired',
    });

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(logoutListener).toHaveBeenCalledOnce();

    window.removeEventListener('auth-logout', logoutListener);
  });
});
