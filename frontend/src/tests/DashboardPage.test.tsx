import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DashboardPage } from '../pages/DashboardPage';
import * as api from '../services/api';

describe('DashboardPage Component', () => {
  it('renders overview dashboard and labels metrics as mock/placeholder', async () => {
    vi.spyOn(api, 'fetchHealth').mockResolvedValueOnce({
      status: 'UP',
      service: 'Inventory and Sales Backend API',
      version: '1.0.0',
      environment: 'development',
      uptimeSeconds: 120,
      database: { connected: true, message: 'Connected' },
      timestamp: new Date().toISOString(),
    });

    render(<DashboardPage />);

    expect(screen.getByText(/Overview Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Products \(Mock\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Revenue \(Mock\)/i)).toBeInTheDocument();
    expect(screen.getByText(/NFR-OPS-01/i)).toBeInTheDocument();
    expect(screen.getByText(/NFR-SEC-03/i)).toBeInTheDocument();
    expect(screen.getByText(/NFR-MNT-01/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText(/Connecting to \/api\/health/i)).not.toBeInTheDocument();
    });
  });
});
