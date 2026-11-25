import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffFormModal } from '../components/staff/StaffFormModal';
import * as api from '../services/api';
import type { StaffUser } from '../services/api';

const staffUser: StaffUser = {
  id: 2,
  name: 'Rafi Ahmed',
  username: 'rafi',
  email: 'rafi@smartmart.local',
  role: 'Sales Staff',
  isActive: true,
  mustResetPw: false,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

function httpError(status: number, data: unknown): AxiosError {
  const error = new AxiosError('request failed');
  error.response = { status, data } as AxiosError['response'];
  return error;
}

function completeCreateForm() {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Rafi Ahmed' } });
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'rafi' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rafi@example.com' } });
  fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'Sales Staff' } });
  fireEvent.change(screen.getByLabelText('Temporary password'), {
    target: { value: 'temporary123' },
  });
}

describe('StaffFormModal (IMS-07)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('validates required fields and input formats without sending a request', () => {
    const create = vi.spyOn(api, 'createStaff').mockResolvedValue();
    render(<StaffFormModal staff={null} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'x'.repeat(121) } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'bad name' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'invalid' } });
    fireEvent.change(screen.getByLabelText('Temporary password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Name must be 120 characters or fewer')).toBeInTheDocument();
    expect(
      screen.getByText('Username must be 3-40 characters (letters, digits, . _ -)'),
    ).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Select a role', { selector: 'p' })).toBeInTheDocument();
    expect(
      screen.getByText('Temporary password must be at least 8 characters'),
    ).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('requires a name and username', () => {
    render(<StaffFormModal staff={null} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Username is required')).toBeInTheDocument();
  });

  it('creates a staff account and reports the initial-password notice', async () => {
    const create = vi.spyOn(api, 'createStaff').mockResolvedValue();
    const onSaved = vi.fn();
    render(<StaffFormModal staff={null} onClose={vi.fn()} onSaved={onSaved} />);
    completeCreateForm();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith('The user must set a new password at first login.'),
    );
    expect(create).toHaveBeenCalledWith({
      name: 'Rafi Ahmed',
      username: 'rafi',
      email: 'rafi@example.com',
      role: 'Sales Staff',
      temporaryPassword: 'temporary123',
    });
  });

  it('shows edit values and keeps username read-only', async () => {
    const update = vi.spyOn(api, 'updateStaff').mockResolvedValue();
    const onSaved = vi.fn();
    render(<StaffFormModal staff={staffUser} onClose={vi.fn()} onSaved={onSaved} />);

    expect(screen.getByRole('heading', { name: 'Edit staff account' })).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toHaveValue('rafi');
    expect(screen.getByLabelText('Username')).toHaveAttribute('readonly');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Rafi A.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('Staff account updated.'));
    expect(update).toHaveBeenCalledWith(2, {
      name: 'Rafi A.',
      email: 'rafi@smartmart.local',
      role: 'Sales Staff',
    });
  });

  it('disables the role control for the logged-in user', () => {
    render(<StaffFormModal staff={staffUser} isOwnAccount onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByLabelText('Role')).toBeDisabled();
    expect(screen.getByLabelText('Role')).toHaveAttribute(
      'title',
      'You cannot change your own role or deactivate your own account.',
    );
  });

  it.each([
    ['USERNAME_TAKEN', 'Username', 'This username is already taken'],
    ['EMAIL_TAKEN', 'Email', 'This email is already used'],
  ])('shows the server %s error inline', async (code, _field, message) => {
    vi.spyOn(api, 'createStaff').mockRejectedValue(httpError(409, { code, message: 'conflict' }));
    render(<StaffFormModal staff={null} onClose={vi.fn()} onSaved={vi.fn()} />);
    completeCreateForm();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('shows a generic message for other server errors', async () => {
    vi.spyOn(api, 'createStaff').mockRejectedValue(httpError(500, { message: 'server error' }));
    render(<StaffFormModal staff={null} onClose={vi.fn()} onSaved={vi.fn()} />);
    completeCreateForm();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Could not save the staff account. Please try again.'),
    ).toBeInTheDocument();
  });
});
