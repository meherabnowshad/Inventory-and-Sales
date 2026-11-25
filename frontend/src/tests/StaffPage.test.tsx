import * as authContext from '../context/AuthContext';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffPage } from '../pages/StaffPage';
import * as api from '../services/api';
import type { StaffListResponse, StaffUser } from '../services/api';

const admin: StaffUser = {
  id: 1,
  name: 'Sadia Rahman',
  username: 'sadia',
  email: 'sadia@smartmart.local',
  role: 'Administrator',
  isActive: true,
  mustResetPw: false,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

const staffResponse = (
  items: StaffUser[] = [admin],
  page = 1,
  total = items.length,
): StaffListResponse => ({ items, page, size: 20, total });

describe('StaffPage (IMS-07)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: {
        id: 1,
        name: 'Sadia Rahman',
        username: 'sadia',
        email: 'sadia@smartmart.local',
        role: 'Administrator',
      },
    } as unknown as ReturnType<typeof authContext.useAuth>);
  });

  it('shows the staff list and requested header', async () => {
    vi.spyOn(api, 'fetchStaff').mockResolvedValue(staffResponse());
    render(<StaffPage />);

    expect(await screen.findByText('Sadia Rahman')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Staff' })).toBeInTheDocument();
    expect(screen.getByText('Manage staff accounts and roles.')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Username' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Staff' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deactivate Sadia Rahman' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Deactivate Sadia Rahman' })).toHaveAttribute(
      'title',
      'You cannot change your own role or deactivate your own account.',
    );
  });

  it('debounces search by 300 ms and sends the search query', async () => {
    vi.useFakeTimers();
    const fetch = vi.spyOn(api, 'fetchStaff').mockResolvedValue(staffResponse());
    render(<StaffPage />);
    expect(fetch).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText('Search staff'), {
      target: { value: '  sadia  ' },
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(299);
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(fetch).toHaveBeenLastCalledWith({
      q: 'sadia',
      role: undefined,
      status: 'all',
      page: 1,
      size: 20,
    });
  });

  it('filters by role and status', async () => {
    const fetch = vi.spyOn(api, 'fetchStaff').mockResolvedValue(staffResponse());
    render(<StaffPage />);
    await screen.findByText('Sadia Rahman');

    fireEvent.change(screen.getByLabelText('Filter by role'), {
      target: { value: 'Sales Staff' },
    });
    expect(fetch).toHaveBeenLastCalledWith({
      q: '',
      role: 'Sales Staff',
      status: 'all',
      page: 1,
      size: 20,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Inactive' }));
    expect(fetch).toHaveBeenLastCalledWith({
      q: '',
      role: 'Sales Staff',
      status: 'inactive',
      page: 1,
      size: 20,
    });
    expect(screen.getByRole('button', { name: 'Inactive' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('paginates and displays the current item range', async () => {
    const fetch = vi
      .spyOn(api, 'fetchStaff')
      .mockImplementation(({ page }) => Promise.resolve(staffResponse([admin], page, 21)));
    render(<StaffPage />);

    expect(await screen.findByText('Showing 1-20 of 21')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    expect(await screen.findByText('Showing 21-21 of 21')).toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith({
      q: '',
      role: undefined,
      status: 'all',
      page: 2,
      size: 20,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(await screen.findByText('Showing 1-20 of 21')).toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith({
      q: '',
      role: undefined,
      status: 'all',
      page: 1,
      size: 20,
    });
  });

  it('shows the empty and error states', async () => {
    const fetch = vi.spyOn(api, 'fetchStaff').mockResolvedValue(staffResponse([], 1, 0));
    const { rerender } = render(<StaffPage />);
    expect(await screen.findByText('No staff match your search.')).toBeInTheDocument();

    fetch.mockRejectedValue(new Error('network down'));
    rerender(<StaffPage />);
    // Changing the selected status causes a fresh request after the failure setup.
    fireEvent.click(screen.getByRole('button', { name: 'Active' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load staff. Please try again.',
    );
  });
});
