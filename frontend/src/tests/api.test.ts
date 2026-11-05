import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchHealth,
  apiClient,
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
  triggerUnauthorized,
  onUnauthorized,
} from '../services/api';

describe('Frontend API Service (fetchHealth)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('resolves with DEGRADED payload on HTTP 503 responses without throwing', async () => {
    const degradedPayload = {
      status: 'DEGRADED' as const,
      service: 'Inventory and Sales Backend API',
      version: '1.0.0',
      environment: 'development',
      uptimeSeconds: 45,
      database: {
        connected: false,
        message: 'Database connection check timed out (1.5s).',
      },
      timestamp: new Date().toISOString(),
    };

    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: degradedPayload,
      status: 503,
      statusText: 'Service Unavailable',
      headers: {},
      config: {} as never,
    });

    const result = await fetchHealth();
    expect(result.status).toBe('DEGRADED');
    expect(result.database.connected).toBe(false);
  });

  it('resolves with UP payload on HTTP 200 responses', async () => {
    const upPayload = {
      status: 'UP' as const,
      service: 'Inventory and Sales Backend API',
      version: '1.0.0',
      environment: 'development',
      uptimeSeconds: 120,
      database: {
        connected: true,
        message: 'PostgreSQL connection verified via Prisma.',
      },
      timestamp: new Date().toISOString(),
    };

    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: upPayload,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    });

    const result = await fetchHealth();
    expect(result.status).toBe('UP');
    expect(result.database.connected).toBe(true);
  });
});

describe('IMS-06.2: Authenticated API Client & Token Storage (FR-AUTH-03)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('triggerUnauthorized clears tokens from localStorage and calls listeners', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'jwt_token_abc');
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({ username: 'sadia' }));

    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);

    triggerUnauthorized();

    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(USER_STORAGE_KEY)).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('unsubscribed listener is not called on triggerUnauthorized', () => {
    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);

    unsubscribe();
    triggerUnauthorized();

    expect(listener).not.toHaveBeenCalled();
  });

  it('request interceptor attaches Bearer token if present in localStorage', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'my_bearer_token_123');

    // Run registered request interceptor
    // Axios stores interceptor handlers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlers = (apiClient.interceptors.request as any).handlers;
    const requestHandler = handlers[0]?.fulfilled;

    if (requestHandler) {
      const config = await requestHandler({ headers: {} });
      expect(config.headers.Authorization).toBe('Bearer my_bearer_token_123');
    }
  });

  it('request interceptor does not set Authorization header if no token is stored', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlers = (apiClient.interceptors.request as any).handlers;
    const requestHandler = handlers[0]?.fulfilled;

    if (requestHandler) {
      const config = await requestHandler({ headers: {} });
      expect(config.headers.Authorization).toBeUndefined();
    }
  });
});
