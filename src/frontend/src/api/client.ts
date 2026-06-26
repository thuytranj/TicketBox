const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

export interface ApiError {
  statusCode: number;
  message: string;
  fieldErrors?: Record<string, string>;
}

class ApiClient {
  private getTokens() {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    return { accessToken, refreshToken };
  }

  private setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  private clearTokens() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${path}`;
    const { accessToken } = this.getTokens();

    const headers = new Headers(options.headers || {});
    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      if (localStorage.getItem('demoUser')) {
        throw await this.parseError(response);
      }

      const refreshed = await this.handleTokenRefresh();
      if (refreshed) {
        const newTokens = this.getTokens();
        const retryHeaders = new Headers(options.headers || {});
        if (newTokens.accessToken) {
          retryHeaders.set('Authorization', `Bearer ${newTokens.accessToken}`);
        }
        if (options.body && !(options.body instanceof FormData) && !retryHeaders.has('Content-Type')) {
          retryHeaders.set('Content-Type', 'application/json');
        }
        const retryResponse = await fetch(url, { ...options, headers: retryHeaders });
        if (retryResponse.ok) {
          return retryResponse.json();
        }
        throw await this.parseError(retryResponse);
      } else {
        this.clearTokens();
        window.dispatchEvent(new Event('auth-logout'));
        throw { statusCode: 401, message: 'Session expired' };
      }
    }

    if (!response.ok) {
      throw await this.parseError(response);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  private async handleTokenRefresh(): Promise<boolean> {
    const { refreshToken } = this.getTokens();
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      if (data.accessToken && data.refreshToken) {
        this.setTokens(data.accessToken, data.refreshToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async parseError(response: Response): Promise<ApiError> {
    try {
      const errorData = await response.json();
      return {
        statusCode: response.status,
        message: errorData.message || 'An error occurred',
        fieldErrors: errorData.fieldErrors || undefined,
      };
    } catch {
      return {
        statusCode: response.status,
        message: response.statusText || 'An error occurred',
      };
    }
  }
}

export const apiClient = new ApiClient();
