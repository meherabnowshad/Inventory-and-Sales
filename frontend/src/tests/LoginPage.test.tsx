import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginPage } from '../pages/LoginPage';
import { AuthProvider } from '../context/AuthContext';
import * as api from '../services/api';

const mockedNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

describe('LoginPage Component (IMS-06.1 / FR-AUTH-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const renderLoginPage = () => {
    return render(
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>,
    );
  };

  it('renders form inputs with accessible labels and no prefilled secrets', () => {
    renderLoginPage();

    const usernameInput = screen.getByLabelText(/username or email/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;

    expect(usernameInput).toBeInTheDocument();
    expect(usernameInput.value).toBe('');

    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput.value).toBe('');
  });

  it('displays client validation errors when submitting empty fields', async () => {
    renderLoginPage();

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/username or email is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
  });

  it('flags malformed email format when input contains @ (FR-AUTH-01)', async () => {
    renderLoginPage();

    const usernameInput = screen.getByLabelText(/username or email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitBtn = screen.getByRole('button', { name: /sign in/i });

    // Enter a malformed email (has @ but invalid format)
    fireEvent.change(usernameInput, { target: { value: 'user@' } });
    fireEvent.change(passwordInput, { target: { value: 'Smart@1234' } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/please enter a valid email address/i)).toBeInTheDocument();
  });

  it('accepts plain usernames without email validation', async () => {
    renderLoginPage();

    const usernameInput = screen.getByLabelText(/username or email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitBtn = screen.getByRole('button', { name: /sign in/i });

    // A plain username (no @) should not trigger email format validation
    fireEvent.change(usernameInput, { target: { value: 'sadia' } });
    fireEvent.change(passwordInput, { target: { value: 'Smart@1234' } });
    fireEvent.click(submitBtn);

    // Should NOT show email validation error — form passes client validation
    await waitFor(() => {
      expect(screen.queryByText(/please enter a valid email address/i)).not.toBeInTheDocument();
    });
  });

  it('enforces password minimum length of 8 characters (FR-AUTH-04)', async () => {
    renderLoginPage();

    const usernameInput = screen.getByLabelText(/username or email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitBtn = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(usernameInput, { target: { value: 'sadia' } });
    fireEvent.change(passwordInput, { target: { value: 'short' } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
  });

  it('displays one generic error that names no field on wrong login (FR-AUTH-01)', async () => {
    renderLoginPage();

    const usernameInput = screen.getByLabelText(/username or email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitBtn = screen.getByRole('button', { name: /sign in/i });

    // Submit invalid credentials
    fireEvent.change(usernameInput, { target: { value: 'unknown_user' } });
    fireEvent.change(passwordInput, { target: { value: 'WrongPassword123' } });
    fireEvent.click(submitBtn);

    // FR-AUTH-01 Acceptance criteria: wrong login shows one generic error that names no field
    const alertBox = await screen.findByRole('alert');
    expect(alertBox).toHaveTextContent(/invalid username or password/i);
  });

  it('successfully logs in with valid credentials and navigates to the role home screen', async () => {
    renderLoginPage();

    const usernameInput = screen.getByLabelText(/username or email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitBtn = screen.getByRole('button', { name: /sign in/i });

    // Login as Rafi (Sales Staff)
    fireEvent.change(usernameInput, { target: { value: 'rafi' } });
    fireEvent.change(passwordInput, { target: { value: 'Smart@1234' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      // Sales Staff home screen is /sales per Gherkin scenario
      expect(mockedNavigate).toHaveBeenCalledWith('/sales', { replace: true });
    });
  });

  it('allows quick fill using demo accounts helper', () => {
    renderLoginPage();

    const sadiaBtn = screen.getByRole('button', { name: /sadia/i });
    fireEvent.click(sadiaBtn);

    const usernameInput = screen.getByLabelText(/username or email/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;

    expect(usernameInput.value).toBe('sadia');
    expect(passwordInput.value).toBe(api.DEMO_PASSWORD);
  });
});
