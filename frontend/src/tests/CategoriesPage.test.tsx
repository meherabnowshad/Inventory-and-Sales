import * as authContext from '../context/AuthContext';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CategoriesPage } from '../pages/CategoriesPage';
import * as api from '../services/api';
import type { CategoryItem } from '../services/api';

// Sample rows returned by the mocked fetchCategories() (shape = CategoryItem in services/api.ts)
const keyboards: CategoryItem = {
  id: 1,
  name: 'Keyboards',
  description: 'Wired and wireless keyboards',
  isActive: true,
  productCount: 6,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};
const headsets: CategoryItem = {
  id: 13,
  name: 'Headsets',
  description: null,
  isActive: false,
  productCount: 0,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

// Tests for pages/CategoriesPage.tsx (IMS-09.1, FR-CAT-04); the API is mocked, no server needed
describe('CategoriesPage (IMS-09.1 / FR-CAT-04)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // The page reads the user's role; pretend an Administrator is logged in (can see Add / Edit)
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      hasRole: () => true,
    } as unknown as ReturnType<typeof authContext.useAuth>);
  });

  it('shows each category with its product count and status', async () => {
    vi.spyOn(api, 'fetchCategories').mockResolvedValue([keyboards, headsets]);
    render(<CategoriesPage />);

    const keyboardsRow = (await screen.findByText('Keyboards')).closest('tr');
    expect(keyboardsRow).toHaveTextContent(/Keyboards.*6.*Active/);

    const headsetsRow = screen.getByText('Headsets').closest('tr');
    expect(headsetsRow).toHaveTextContent(/Headsets.*0.*Inactive/);
  });

  it('loads all categories first, then asks the API for inactive ones when the filter changes', async () => {
    const spy = vi.spyOn(api, 'fetchCategories').mockResolvedValue([keyboards]);
    render(<CategoriesPage />);

    await screen.findByText('Keyboards');
    expect(spy).toHaveBeenCalledWith('all');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');

    spy.mockResolvedValue([headsets]);
    fireEvent.click(screen.getByRole('button', { name: 'Inactive' }));

    expect(await screen.findByText('Headsets')).toBeInTheDocument();
    expect(spy).toHaveBeenLastCalledWith('inactive');
    expect(screen.queryByText('Keyboards')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inactive' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows an empty-state message that names the selected filter', async () => {
    vi.spyOn(api, 'fetchCategories').mockResolvedValue([]);
    render(<CategoriesPage />);

    expect(await screen.findByText('There are no categories yet.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Inactive' }));
    expect(await screen.findByText('There are no inactive categories.')).toBeInTheDocument();
  });

  it('shows an error message when the request fails', async () => {
    vi.spyOn(api, 'fetchCategories').mockRejectedValue(new Error('network down'));
    render(<CategoriesPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load categories');
  });

  it('shows Add and Edit buttons for roles that may write', async () => {
    vi.spyOn(api, 'fetchCategories').mockResolvedValue([keyboards]);
    render(<CategoriesPage />);

    await screen.findByText('Keyboards');
    expect(screen.getByRole('button', { name: 'Add category' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Keyboards' })).toBeInTheDocument();
  });

  it('hides Add and Edit buttons for roles that may only read (Sales Staff)', async () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      hasRole: () => false,
    } as unknown as ReturnType<typeof authContext.useAuth>);
    vi.spyOn(api, 'fetchCategories').mockResolvedValue([keyboards]);
    render(<CategoriesPage />);

    await screen.findByText('Keyboards');
    expect(screen.queryByRole('button', { name: 'Add category' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument();
    // IMS-09.3: Deactivate and Delete are write actions too
    expect(screen.queryByRole('button', { name: /^Deactivate / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Delete / })).not.toBeInTheDocument();
  });

  // IMS-09.3 (FR-CAT-03): Deactivate with confirmation; the confirm dialog itself is tested in CategoryConfirmDialog.test.tsx
  it('shows Deactivate only on active rows, and Delete on every row', async () => {
    vi.spyOn(api, 'fetchCategories').mockResolvedValue([keyboards, headsets]);
    render(<CategoriesPage />);

    await screen.findByText('Keyboards');
    expect(screen.getByRole('button', { name: 'Deactivate Keyboards' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deactivate Headsets' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Keyboards' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Headsets' })).toBeInTheDocument();
  });

  it('opens the confirmation dialog on Deactivate and sends nothing until confirmed', async () => {
    vi.spyOn(api, 'fetchCategories').mockResolvedValue([keyboards]);
    const patch = vi.spyOn(api, 'setCategoryActive').mockResolvedValue();
    render(<CategoriesPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Deactivate Keyboards' }));

    expect(screen.getByRole('heading', { name: 'Deactivate category?' })).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
  });

  it('after confirming Deactivate: closes the dialog, shows the message and reloads the list', async () => {
    const list = vi.spyOn(api, 'fetchCategories').mockResolvedValue([keyboards]);
    vi.spyOn(api, 'setCategoryActive').mockResolvedValue();
    render(<CategoriesPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Deactivate Keyboards' }));
    list.mockResolvedValue([{ ...keyboards, isActive: false }]); // what the API returns after the change
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByText('Category "Keyboards" deactivated.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // "Inactive" is also a filter button, so check the status badge inside the row
    await waitFor(() =>
      expect(screen.getByText('Keyboards').closest('tr')).toHaveTextContent(/Keyboards.*Inactive/),
    );
    expect(list).toHaveBeenCalledTimes(2);
  });
});
