import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import { Header } from '../components/layout/Header';
import { AuthProvider } from '../context/AuthContext';
import { TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from '../services/api';

describe('Header Component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <BrowserRouter>
        <AuthProvider>{ui}</AuthProvider>
      </BrowserRouter>,
    );
  };

  it('renders brand name and sign in button when unauthenticated', () => {
    renderWithProviders(<Header />);
    expect(screen.getByText(/SmartMart/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders user name and sign out button when authenticated', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'test_token');
    localStorage.setItem(
      USER_STORAGE_KEY,
      JSON.stringify({
        id: 1,
        name: 'Sadia Rahman',
        username: 'sadia',
        email: 'sadia@smartmart.local',
        role: 'Administrator',
      }),
    );

    renderWithProviders(<Header />);
    expect(screen.getByText('Sadia Rahman')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });
});
