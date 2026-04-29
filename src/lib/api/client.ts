/**
 * API client for frontend to communicate with backend
 * Handles authentication, error handling, and request formatting
 */

import { getAuth } from 'firebase/auth';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

/**
 * Get Firebase ID token for authenticated requests
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
}

/**
 * Make API request with authentication
 */
async function apiRequest<T>(
  method: string,
  endpoint: string,
  body?: unknown
): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken();
    if (!token) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        },
      };
    }

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`/api${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error,
      };
    }

    return data as ApiResponse<T>;
  } catch (error) {
    console.error('API request failed:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Network request failed',
      },
    };
  }
}

// User API endpoints
export const userApi = {
  getProfile: () => apiRequest('/users', 'GET'),
  updateProfile: (data: unknown) => apiRequest('/users', 'POST', data),
};

// Battery API endpoints
export const batteryApi = {
  list: (params?: { status?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.offset) query.append('offset', params.offset.toString());
    const queryString = query.toString();
    return apiRequest(
      `/batteries${queryString ? '?' + queryString : ''}`,
      'GET'
    );
  },
  claim: (data: unknown) => apiRequest('/batteries', 'POST', data),
};

// Telemetry API endpoints
export const telemetryApi = {
  fetch: (params: {
    batteryId: string;
    limit?: number;
    startTime?: number;
    endTime?: number;
  }) => {
    const query = new URLSearchParams();
    query.append('batteryId', params.batteryId);
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.startTime) query.append('startTime', params.startTime.toString());
    if (params.endTime) query.append('endTime', params.endTime.toString());
    return apiRequest(`/telemetry?${query.toString()}`, 'GET');
  },
};

// Invoice API endpoints
export const invoiceApi = {
  list: (params?: { limit?: number; offset?: number; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.offset) query.append('offset', params.offset.toString());
    if (params?.status) query.append('status', params.status);
    const queryString = query.toString();
    return apiRequest(
      `/invoices${queryString ? '?' + queryString : ''}`,
      'GET'
    );
  },
};

// Billing API endpoints
export const billingApi = {
  getSummary: () => apiRequest<{
    activeBatteryCount: number;
    subscription: {
      tier: string;
      pricePerUnit: number;
      currentPeriodEnd: string;
    };
    summary: {
      subtotal: number;
      gstAmount: number;
      grandTotal: number;
    }
  }>('/billing/summary', 'GET'),
};
