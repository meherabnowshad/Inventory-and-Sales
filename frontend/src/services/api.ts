import axios from 'axios';
import { AuthResponse, LoginCredentials, AuthUser, UserRole } from '../types/auth';

// Defaults to '/api' so Vite proxy in vite.config.ts forwards to http://localhost:5001/api without CORS
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Storage keys
export const TOKEN_STORAGE_KEY = 'smartmart_auth_token';
export const USER_STORAGE_KEY = 'smartmart_auth_user';
export const REFRESH_TOKEN_STORAGE_KEY = 'smartmart_refresh_token';

// Listeners for 401 Unauthorized events (IMS-06.2)
type UnauthorizedHandler = () => void;
const unauthorizedHandlers = new Set<UnauthorizedHandler>();

export function onUnauthorized(handler: UnauthorizedHandler): () => void {
  unauthorizedHandlers.add(handler);
  return () => {
    unauthorizedHandlers.delete(handler);
  };
}

export function triggerUnauthorized(): void {
  // Clear stored tokens
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  unauthorizedHandlers.forEach((handler) => handler());
}

// Request Interceptor: Attach Bearer token if present
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor: Catch 401 Unauthorized and auto-refresh session (IMS-05.3 / FR-AUTH-03)
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    // Don't intercept refresh or login calls
    if (
      error.response &&
      error.response.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
      if (!refreshToken) {
        triggerUnauthorized();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });
        const { token, accessToken, refreshToken: newRefreshToken } = refreshResponse.data;
        const finalAccessToken = accessToken || token;

        localStorage.setItem(TOKEN_STORAGE_KEY, finalAccessToken);
        if (newRefreshToken) {
          localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, newRefreshToken);
        }

        processQueue(null, finalAccessToken);
        originalRequest.headers.Authorization = `Bearer ${finalAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        triggerUnauthorized();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response && error.response.status === 401) {
      triggerUnauthorized();
    }
    return Promise.reject(error);
  },
);

export interface HealthResponse {
  status: 'UP' | 'DEGRADED';
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  database: {
    connected: boolean;
    message: string;
  };
  timestamp: string;
}

export async function fetchHealth(): Promise<HealthResponse> {
  // Accept both 200 (UP) and 503 (DEGRADED) so offline DB state is properly reported to the UI
  const response = await apiClient.get<HealthResponse>('/health', {
    validateStatus: (status) => status === 200 || status === 503,
  });
  return response.data;
}

// Canonical Demo Accounts from SRS & Engineering Spec v0.3
export const DEMO_USERS = [
  {
    id: 1,
    name: 'Sadia Rahman',
    username: 'sadia',
    email: 'sadia@smartmart.local',
    role: 'Administrator' as const,
  },
  {
    id: 2,
    name: 'Rafi Ahmed',
    username: 'rafi',
    email: 'rafi@smartmart.local',
    role: 'Sales Staff' as const,
  },
  {
    id: 3,
    name: 'Mitu Akter',
    username: 'mitu',
    email: 'mitu@smartmart.local',
    role: 'Store Staff' as const,
  },
];

export const DEMO_PASSWORD = 'Smart@1234';

/**
 * IMS-06.1 Login API call
 * Attempts real API call first (/auth/login). In Sprint 1 before IMS-05 is deployed,
 * gracefully handles authentication using the canonical seed data per FR-AUTH-01.
 */
export async function loginApi(credentials: LoginCredentials): Promise<AuthResponse> {
  const normalizedInput = credentials.usernameOrEmail.trim().toLowerCase();

  try {
    const response = await apiClient.post<AuthResponse>('/auth/login', {
      usernameOrEmail: credentials.usernameOrEmail.trim(),
      password: credentials.password,
    });
    if (response.data.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, response.data.refreshToken);
    }
    return response.data;
  } catch (error: unknown) {
    // If backend returns a deliberate 429/401/400 error response from real API, never fall back to mock
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status === 429) {
        const data = error.response.data as { detail?: string; message?: string };
        throw new Error(
          data?.detail ||
            data?.message ||
            'Too many failed login attempts. Please try again in 15 minutes.',
        );
      }
      if (error.response.status === 401) {
        throw new Error('Invalid username or password');
      }
      if (error.response.status === 400) {
        const msg = (error.response.data as { message?: string | string[] })?.message;
        throw new Error(Array.isArray(msg) ? msg[0] : msg || 'Invalid login request');
      }
    }

    // Sprint 1 Mock/Stub fallback (IMS-06.1 & Master Test Plan Section 2/9)
    // Validate against seed credentials
    const matchedUser = DEMO_USERS.find(
      (u) =>
        u.username.toLowerCase() === normalizedInput || u.email.toLowerCase() === normalizedInput,
    );

    if (matchedUser && credentials.password === DEMO_PASSWORD) {
      const mockToken = `sprint1_mock_jwt_${matchedUser.username}_${Date.now()}`;
      return {
        user: matchedUser,
        token: mockToken,
      };
    }

    // FR-AUTH-01: Wrong login shows one generic error that names no field
    throw new Error('Invalid username or password');
  }
}

export async function refreshSessionApi(): Promise<AuthResponse | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  if (!refreshToken) return null;
  try {
    const res = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/refresh`, { refreshToken });
    const { token, accessToken, refreshToken: newRefreshToken, user } = res.data;
    const finalToken = accessToken || token;
    localStorage.setItem(TOKEN_STORAGE_KEY, finalToken);
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    }
    if (newRefreshToken) {
      localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, newRefreshToken);
    }
    return res.data;
  } catch {
    triggerUnauthorized();
    return null;
  }
}

export async function logoutApi(): Promise<void> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  try {
    if (refreshToken) {
      await apiClient.post('/auth/logout', { refreshToken });
    } else {
      await apiClient.post('/auth/logout');
    }
  } catch {
    // Graceful fallback for offline / stub
  } finally {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  }
}

/**
 * Validates the current token against backend /auth/me (IMS-05.2)
 * If the token has been revoked, triggers 401 unauthorized cleanup.
 */
export async function getProfileApi(): Promise<AuthUser | null> {
  try {
    const response = await apiClient.get<AuthUser>('/auth/me');
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response && error.response.status === 401) {
      triggerUnauthorized();
    }
    return null;
  }
}

export interface ProductItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: string;
  stock: number;
  minStock: number;
  isActive?: boolean;
}

export async function fetchProducts(): Promise<ProductItem[]> {
  try {
    const response = await apiClient.get<{ success: boolean; data: ProductItem[] }>('/inventory');
    if (response.data && response.data.data && response.data.data.length > 0) {
      return response.data.data;
    }
  } catch {
    // Graceful fallback for offline / mock
  }
  return [];
}

export interface SaleItem {
  id: string;
  saleNumber: string;
  itemsCount: number;
  totalAmount: string;
  taxAmount: string;
  date: string;
  status: 'COMPLETED' | 'PENDING' | 'CANCELLED';
}

export async function fetchSales(): Promise<SaleItem[]> {
  try {
    const response = await apiClient.get<{ success: boolean; data: SaleItem[] }>('/sales');
    if (response.data && response.data.data && response.data.data.length > 0) {
      return response.data.data;
    }
  } catch {
    // Graceful fallback for offline / mock
  }
  return [];
}

// IMS-09.1: one item of GET /api/categories (FR-CAT-04); used by pages/CategoriesPage.tsx
export interface CategoryItem {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  productCount: number; // all products in the category, active and inactive (IMS-08.4)
  createdAt: string;
  updatedAt: string;
}

export interface StaffUser {
  id: number;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustResetPw: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StaffListResponse {
  items: StaffUser[];
  page: number;
  size: number;
  total: number;
}

export type StaffStatusFilter = 'all' | 'active' | 'inactive';

export interface StaffListParams {
  q?: string;
  role?: UserRole;
  status: StaffStatusFilter;
  page: number;
  size: number;
}

export interface CreateStaffInput {
  name: string;
  username: string;
  email: string;
  role: UserRole;
  temporaryPassword: string;
}

export interface UpdateStaffInput {
  name?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
}

export async function fetchStaff(params: StaffListParams): Promise<StaffListResponse> {
  const response = await apiClient.get<StaffListResponse>('/users', { params });
  return response.data;
}

export async function createStaff(input: CreateStaffInput): Promise<void> {
  await apiClient.post('/users', input);
}

export async function updateStaff(id: number, input: UpdateStaffInput): Promise<void> {
  await apiClient.patch(`/users/${id}`, input);
}

// Values of the ?status= query parameter accepted by the backend (default is 'all')
export type CategoryStatusFilter = 'all' | 'active' | 'inactive';

// Called by CategoriesPage whenever the filter changes; errors are NOT swallowed,
// so the page can show an error message (unlike fetchProducts, which falls back to mock data)
export async function fetchCategories(
  status: CategoryStatusFilter = 'all',
): Promise<CategoryItem[]> {
  const response = await apiClient.get<CategoryItem[]>('/categories', { params: { status } });
  return response.data;
}

// IMS-09.2: body of POST /api/categories and PATCH /api/categories/:id (FR-CAT-01, FR-CAT-02)
export interface CategoryInput {
  name: string;
  description?: string;
}

// Used by components/categories/CategoryFormModal.tsx to create a category
export async function createCategory(input: CategoryInput): Promise<void> {
  await apiClient.post('/categories', input);
}

// Used by the same form in edit mode to rename or change the description
export async function updateCategory(id: number, input: CategoryInput): Promise<void> {
  await apiClient.patch(`/categories/${id}`, input);
}

// IMS-09.3: Deactivate sends only isActive; used by components/categories/CategoryConfirmDialog.tsx
// Backend always allows it, even while products use the category (FR-CAT-03, BR-11)
export async function setCategoryActive(id: number, isActive: boolean): Promise<void> {
  await apiClient.patch(`/categories/${id}`, { isActive });
}

// IMS-09.3: used by the same dialog in Delete mode; 204 when deleted, 404 if gone,
// 409 CATEGORY_IN_USE (with productCount) while any product, active or inactive, uses it
export async function deleteCategory(id: number): Promise<void> {
  await apiClient.delete(`/categories/${id}`);
}

// What the form needs to know about a failed request
export interface ApiErrorInfo {
  status?: number; // HTTP status, e.g. 409 or 400
  code?: string; // backend code, e.g. CATEGORY_NAME_TAKEN
  messages: string[]; // human-readable messages from the backend
  productCount?: number; // only on 409 CATEGORY_IN_USE; read by CategoryConfirmDialog (IMS-09.3)
}

// Turns any error into ApiErrorInfo; the backend sends either {message: string[]} (400)
// or {code, message} (409, e.g. CATEGORY_NAME_TAKEN); CATEGORY_IN_USE also carries productCount
export function readApiError(error: unknown): ApiErrorInfo {
  if (axios.isAxiosError(error) && error.response) {
    const data = error.response.data as
      { code?: string; message?: string | string[]; productCount?: number } | undefined;
    const raw = data?.message;
    const messages = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return {
      status: error.response.status,
      code: data?.code,
      messages,
      productCount: data?.productCount,
    };
  }
  return { messages: [] };
}
