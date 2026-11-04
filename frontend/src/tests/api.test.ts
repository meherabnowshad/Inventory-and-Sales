import { describe, it, expect, vi } from 'vitest';
import { fetchHealth, apiClient } from '../services/api';

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
