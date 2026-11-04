import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { LoginPage } from '../pages/LoginPage';

describe('LoginPage Component', () => {
  it('renders form inputs with accessible labels and no prefilled secrets', () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>,
    );

    const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;

    expect(emailInput).toBeInTheDocument();
    expect(emailInput.value).toBe(''); // No hardcoded prefill

    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput.value).toBe(''); // No hardcoded password
  });

  it('handles submission and presents clear Sprint 1 skeleton notice', () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>,
    );

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitBtn = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'cashier@inventory.local' } });
    fireEvent.change(passwordInput, { target: { value: 'SecretPass123!' } });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/Sprint 1 Authentication Skeleton/i)).toBeInTheDocument();
    expect(screen.getByText(/Return to Overview Dashboard/i)).toBeInTheDocument();
  });
});
