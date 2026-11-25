import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffConfirmDialog } from '../components/staff/StaffConfirmDialog';
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

describe('StaffConfirmDialog (IMS-07)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('deactivates only after confirmation', async () => {
    const update = vi.spyOn(api, 'updateStaff').mockResolvedValue();
    const onDone = vi.fn();
    render(<StaffConfirmDialog staff={staffUser} onClose={vi.fn()} onDone={onDone} />);

    expect(screen.getByRole('heading', { name: 'Deactivate staff account?' })).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith('Staff account "Rafi Ahmed" deactivated.'),
    );
    expect(update).toHaveBeenCalledWith(2, { isActive: false });
  });

  it('reactivates an inactive account', async () => {
    const update = vi.spyOn(api, 'updateStaff').mockResolvedValue();
    render(
      <StaffConfirmDialog
        staff={{ ...staffUser, isActive: false }}
        onClose={vi.fn()}
        onDone={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Reactivate staff account?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reactivate' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(2, { isActive: true }));
  });

  it('shows the last-administrator server error', async () => {
    vi.spyOn(api, 'updateStaff').mockRejectedValue(
      httpError(409, { code: 'LAST_ADMIN', message: 'last admin' }),
    );
    render(<StaffConfirmDialog staff={staffUser} onClose={vi.fn()} onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'At least one active Administrator is required.',
    );
  });

  it('shows the own-account server error', async () => {
    vi.spyOn(api, 'updateStaff').mockRejectedValue(
      httpError(403, { code: 'CANNOT_MODIFY_OWN_ACCOUNT', message: 'forbidden' }),
    );
    render(<StaffConfirmDialog staff={staffUser} onClose={vi.fn()} onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You cannot change your own role or deactivate your own account.',
    );
  });
});
