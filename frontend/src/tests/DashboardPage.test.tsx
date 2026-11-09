import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DashboardPage } from '../pages/DashboardPage';

describe('DashboardPage Component', () => {
  it('renders overview dashboard and labels metrics as mock/placeholder', () => {
    render(<DashboardPage />);

    expect(screen.getByText(/Overview Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Products \(Mock\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Revenue \(Mock\)/i)).toBeInTheDocument();
  });
});
