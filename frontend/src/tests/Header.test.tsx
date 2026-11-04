import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Header } from '../components/layout/Header';
import * as api from '../services/api';

describe('Header Component Health Badge', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('displays Connected (UP) when backend reports healthy status', async () => {
    vi.spyOn(api, 'fetchHealth').mockResolvedValueOnce({
      status: 'UP',
      service: 'Inventory and Sales Backend API',
      version: '1.0.0',
      environment: 'development',
      uptimeSeconds: 50,
      database: { connected: true, message: 'OK' },
      timestamp: new Date().toISOString(),
    });

    render(<Header />);

    await waitFor(() => {
      expect(screen.getByText(/Connected \(UP\)/i)).toBeInTheDocument();
    });
  });

  it('displays Degraded (DB Offline) when database is disconnected (HTTP 503)', async () => {
    vi.spyOn(api, 'fetchHealth').mockResolvedValueOnce({
      status: 'DEGRADED',
      service: 'Inventory and Sales Backend API',
      version: '1.0.0',
      environment: 'development',
      uptimeSeconds: 50,
      database: { connected: false, message: 'DB down' },
      timestamp: new Date().toISOString(),
    });

    render(<Header />);

    await waitFor(() => {
      expect(screen.getByText(/Degraded \(DB Offline\)/i)).toBeInTheDocument();
    });
  });
});
