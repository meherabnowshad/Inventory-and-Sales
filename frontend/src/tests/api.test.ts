import axios from 'axios';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchHealth,
  apiClient,
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
  onUnauthorized,
  triggerUnauthorized,
  logoutApi,
  loginApi,
  refreshSessionApi,
} from '../services/api';

describe('Frontend API Service (fetchHealth)', () => {
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

describe('IMS-06.2: Token Storage & Authenticated API Client (FR-AUTH-03)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('attaches Bearer token in request headers when token is stored', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'bearer-jwt-token-xyz');

    // Retrieve the registered request interceptor handler
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestHandler = (apiClient.interceptors.request as any).handlers[0]?.fulfilled;
    expect(requestHandler).toBeDefined();

    const config = requestHandler({ headers: {} });
    expect(config.headers.Authorization).toBe('Bearer bearer-jwt-token-xyz');
  });

  it('does not attach Authorization header when no token is present', () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestHandler = (apiClient.interceptors.request as any).handlers[0]?.fulfilled;
    expect(requestHandler).toBeDefined();

    const config = requestHandler({ headers: {} });
    expect(config.headers.Authorization).toBeUndefined();
  });

  it('triggers unauthorized cleanup and fires listener on 401 response', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'stale-token');
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({ name: 'Test User' }));
    localStorage.setItem('smartmart_refresh_token', 'legacy-refresh-token');

    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);

    // Retrieve the registered response interceptor rejected handler
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errorHandler = (apiClient.interceptors.response as any).handlers[0]?.rejected;
    expect(errorHandler).toBeDefined();

    await expect(errorHandler({ response: { status: 401 } })).rejects.toBeDefined();

    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(USER_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('smartmart_refresh_token')).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('does not clear session on non-401 errors (e.g. 500 or 404)', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'valid-token');
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({ name: 'Active User' }));

    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errorHandler = (apiClient.interceptors.response as any).handlers[0]?.rejected;
    expect(errorHandler).toBeDefined();

    await expect(errorHandler({ response: { status: 500 } })).rejects.toBeDefined();

    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('valid-token');
    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('allows unsubscribing from 401 notifications', () => {
    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);

    triggerUnauthorized();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    triggerUnauthorized();
    // Should still only be 1 because listener unsubscribed
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('logoutApi calls /auth/logout and clears localStorage tokens', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'token-to-logout');
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({ id: 1 }));

    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: {} });

    await logoutApi();

    expect(postSpy).toHaveBeenCalledWith('/auth/logout');
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(USER_STORAGE_KEY)).toBeNull();
  });

  it('does not persist refresh tokens returned from login', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: {
        user: {
          id: 1,
          name: 'Test User',
          username: 'test',
          email: 'test@example.com',
          role: 'Administrator',
        },
        token: 'access-token',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      },
    } as never);

    await loginApi({ usernameOrEmail: 'test', password: 'password' });

    expect(postSpy).toHaveBeenCalledWith('/auth/login', {
      usernameOrEmail: 'test',
      password: 'password',
    });
    expect(localStorage.getItem('smartmart_refresh_token')).toBeNull();
  });

  it('refreshes with the HttpOnly cookie without storing a refresh token', async () => {
    const postSpy = vi.spyOn(axios, 'post').mockResolvedValueOnce({
      data: {
        user: {
          id: 1,
          name: 'Test User',
          username: 'test',
          email: 'test@example.com',
          role: 'Administrator',
        },
        token: 'new-access-token',
        accessToken: 'new-access-token',
      },
    } as never);

    await refreshSessionApi();

    expect(postSpy).toHaveBeenCalledWith('/api/auth/refresh', {}, { withCredentials: true });
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('new-access-token');
    expect(localStorage.getItem('smartmart_refresh_token')).toBeNull();
  });
});
