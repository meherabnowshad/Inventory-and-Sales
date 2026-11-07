import axios from 'axios';
import { AuthResponse, LoginCredentials } from '../types/auth';

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

// Response Interceptor: Catch 401 Unauthorized and notify listeners
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
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
    return response.data;
  } catch (error: unknown) {
    // If backend returns a deliberate 401/400 error response from real API
    if (axios.isAxiosError(error) && error.response && error.response.status === 401) {
      throw new Error('Invalid username or password');
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

export async function logoutApi(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } catch {
    // Graceful fallback for offline / stub
  } finally {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
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
