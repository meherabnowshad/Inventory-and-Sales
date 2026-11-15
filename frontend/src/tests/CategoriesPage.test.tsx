import { render, screen, fireEvent } from '@testing-library/react';
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
});
