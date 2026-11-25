import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import { Sidebar } from '../components/layout/Sidebar';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { NoAccessPage } from '../pages/NoAccessPage';
import {
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
  triggerUnauthorized,
  apiClient,
} from '../services/api';
import { AuthUser } from '../types/auth';

const ADMIN_USER: AuthUser = {
  id: 1,
  name: 'Sadia Rahman',
  username: 'sadia',
  email: 'sadia@smartmart.local',
  role: 'Administrator',
};

const SALES_USER: AuthUser = {
  id: 2,
  name: 'Rafi Ahmed',
  username: 'rafi',
  email: 'rafi@smartmart.local',
  role: 'Sales Staff',
};

const STORE_USER: AuthUser = {
  id: 3,
  name: 'Mitu Akter',
  username: 'mitu',
  email: 'mitu@smartmart.local',
  role: 'Store Staff',
};

describe('IMS-06.2: Token Storage & 401 Handling', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('stores and restores auth session from localStorage', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'test_jwt_token_123');
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(ADMIN_USER));

    render(
      <MemoryRouter>
        <AuthProvider>
          <Sidebar />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Sadia Rahman')).toBeInTheDocument();
    expect(screen.getByText('Administrator')).toBeInTheDocument();
  });

  it('clears stored session and redirects when 401 is triggered (FR-AUTH-03 / IMS-06.2 done-when)', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'test_jwt_token_123');
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(ADMIN_USER));

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<div>Dashboard Protected</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Dashboard Protected')).toBeInTheDocument();

    // Trigger 401 unauthorized wrapped in act
    act(() => {
      triggerUnauthorized();
    });

    // Verify localStorage cleared
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(USER_STORAGE_KEY)).toBeNull();

    // IMS-06.2 done-when: A 401 sends the user to login
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
  });
});

describe('IMS-06.3: Role-Based Navigation & No-Access Screen (FR-AUTH-07)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('Administrator sees Dashboard, Inventory, and Sales navigation links', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'admin_token');
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(ADMIN_USER));

    render(
      <MemoryRouter>
        <AuthProvider>
          <Sidebar />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /inventory/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sales & orders/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Staff' })).toBeInTheDocument();
  });

  it('Sales Staff menu hides Dashboard and displays Sales and Inventory (FR-AUTH-07 Gherkin)', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'sales_token');
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(SALES_USER));

    render(
      <MemoryRouter>
        <AuthProvider>
          <Sidebar />
        </AuthProvider>
      </MemoryRouter>,
    );

    // Sales staff must NOT see Dashboard link
    expect(screen.queryByRole('link', { name: /dashboard/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Staff' })).not.toBeInTheDocument();
    // Sales staff sees Sales and Inventory
    expect(screen.getByRole('link', { name: /sales & orders/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /inventory/i })).toBeInTheDocument();
  });

  it('Store Staff menu hides Dashboard and Sales', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'store_token');
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(STORE_USER));

    render(
      <MemoryRouter>
        <AuthProvider>
          <Sidebar />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: /dashboard/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sales & orders/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Staff' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /inventory/i })).toBeInTheDocument();
  });

  it('shows No Access page when a role navigates directly to a restricted URL (FR-AUTH-07)', () => {
    // Logged in as Sales Staff trying to open the Administrator-only Staff screen
    localStorage.setItem(TOKEN_STORAGE_KEY, 'sales_token');
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(SALES_USER));

    render(
      <MemoryRouter initialEntries={['/staff']}>
        <AuthProvider>
          <Routes>
            <Route element={<ProtectedRoute allowedRoles={['Administrator']} />}>
              <Route path="/staff" element={<div>Staff Management</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    // Secret content should not render
    expect(screen.queryByText('Staff Management')).not.toBeInTheDocument();

    // 403 Forbidden Access Denied page is rendered directly
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    expect(screen.getByText(/403 forbidden/i)).toBeInTheDocument();
    expect(screen.getByText('Rafi Ahmed')).toBeInTheDocument();
    expect(screen.getByText('Sales Staff')).toBeInTheDocument();
  });

  it('NoAccessPage provides button returning user to their role home screen', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'sales_token');
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(SALES_USER));

    render(
      <MemoryRouter>
        <AuthProvider>
          <NoAccessPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    const homeLink = screen.getByRole('link', { name: /return to your home screen/i });
    expect(homeLink).toHaveAttribute('href', '/sales');
  });

  it('Sign Out button logs out user and removes session', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValue({ data: {} });
    localStorage.setItem(TOKEN_STORAGE_KEY, 'sales_token');
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(SALES_USER));

    render(
      <MemoryRouter>
        <AuthProvider>
          <Sidebar />
        </AuthProvider>
      </MemoryRouter>,
    );

    const logoutBtn = screen.getByRole('button', { name: /sign out/i });
    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem(USER_STORAGE_KEY)).toBeNull();
    });
  });
});
