// Thin wrapper around fetch that:
//   - prefixes the API base URL
//   - attaches JWT bearer token
//   - unwraps the { success, data } envelope to return .data
//   - throws an ApiError on non-2xx

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL ?? '/api/v1';

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: any) {
    super(message);
  }
}

function getToken(): string | null {
  return localStorage.getItem('geny.admin.token');
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('geny.admin.token', token);
  else localStorage.removeItem('geny.admin.token');
}

async function request<T = any>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    ...(opts.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...opts, headers });

  let body: any;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const message =
      (body && (body.message || (Array.isArray(body.message) ? body.message.join(', ') : null))) ||
      `HTTP ${res.status}`;
    if (res.status === 401) {
      setToken(null);
      // Redirect to login
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    throw new ApiError(res.status, message, body);
  }

  if (body && body.success === true) return body.data as T;
  return body as T;
}

export const api = {
  // Auth
  login: (identifier: string, password: string) =>
    request<{ accessToken: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),

  me: () => request<{ id: string; email: string; role: string; firstName: string; lastName: string }>('/auth/me'),

  // Users
  listUsers: () => request<{ users: any[] } | any[]>('/users'),

  // Drivers
  listDrivers: () => request<{ drivers: any[] } | any[]>('/drivers'),

  // Restaurants
  listRestaurants: (filter?: string) =>
    request<{ restaurants: any[] } | any[]>(`/restaurants${filter ? `?filter=${encodeURIComponent(filter)}` : ''}`),
  updateRestaurant: (id: string, body: any) =>
    request(`/restaurants/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteRestaurant: (id: string) =>
    request(`/restaurants/${id}`, { method: 'DELETE' }),

  // Trips + Orders
  listTrips: (params?: Record<string, string | number>) =>
    request<{ trips: any[] } | any[]>(`/trips${qs(params)}`), 
  listOrders: (params?: Record<string, string | number>) =>
    request<{ orders: any[] } | any[]>(`/orders${qs(params)}`),

  // Payments
  listPayments: () => request(`/payments`), // (note: backend doesn't yet expose list)
  refund: (id: string, amount?: number) =>
    request(`/payments/${id}/refund`, { method: 'POST', body: JSON.stringify({ amount }) }),

  // Ratings
  listRatings: (target: string, targetId: string) =>
    request<{ ratings: any[] } | any[]>(`/ratings?target=${target}&targetId=${targetId}`),
};

function qs(params?: Record<string, string | number>): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => sp.set(k, String(v)));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export function unwrapList<T>(response: any): T[] {
  if (Array.isArray(response)) return response as T[];
  if (response && typeof response === 'object') {
    for (const key of ['data', 'items', 'users', 'drivers', 'restaurants', 'trips', 'orders', 'ratings', 'payments']) {
      if (Array.isArray((response as any)[key])) return (response as any)[key] as T[];
    }
  }
  return [];
}

export function unwrapObject<T = any>(response: any): T {
  if (response && typeof response === 'object' && (response as any).data) {
    return (response as any).data as T;
  }
  return response as T;
}
