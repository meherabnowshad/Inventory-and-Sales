import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';
import { CategoryFormModal } from '../components/categories/CategoryFormModal';
import * as api from '../services/api';
import type { CategoryItem } from '../services/api';

const keyboards: CategoryItem = {
  id: 1,
  name: 'Keyboards',
  description: 'Wired and wireless keyboards',
  isActive: true,
  productCount: 6,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

// Builds the error axios throws for an HTTP error, so the form's catch block runs as in the real app
function httpError(status: number, data: unknown): AxiosError {
  const err = new AxiosError('request failed');
  err.response = { status, data } as AxiosError['response'];
  return err;
}

// Tests for components/categories/CategoryFormModal.tsx (IMS-09.2, FR-CAT-01, FR-CAT-02); API is mocked
describe('CategoryFormModal (IMS-09.2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('names the field when the name is empty and sends nothing', () => {
    const create = vi.spyOn(api, 'createCategory').mockResolvedValue();
    render(<CategoryFormModal category={null} onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('names the field when the name or description is too long', () => {
    render(<CategoryFormModal category={null} onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'x'.repeat(81) } });
    fireEvent.change(screen.getByLabelText(/Description/), { target: { value: 'y'.repeat(256) } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Name must be 80 characters or fewer')).toBeInTheDocument();
    expect(screen.getByText('Description must be 255 characters or fewer')).toBeInTheDocument();
  });

  it('creates a category with a trimmed name and reports success', async () => {
    const create = vi.spyOn(api, 'createCategory').mockResolvedValue();
    const onSaved = vi.fn();
    render(<CategoryFormModal category={null} onClose={vi.fn()} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Snacks  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('Category "Snacks" created.'));
    expect(create).toHaveBeenCalledWith({ name: 'Snacks', description: undefined });
  });

  it('shows the duplicate-name message under the Name field on 409 CATEGORY_NAME_TAKEN', async () => {
    vi.spyOn(api, 'createCategory').mockRejectedValue(
      httpError(409, { code: 'CATEGORY_NAME_TAKEN', message: 'taken' }),
    );
    const onSaved = vi.fn();
    render(<CategoryFormModal category={null} onClose={vi.fn()} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'keyboards' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('A category with this name already exists (case is ignored)'),
    ).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('matches a backend 400 message to its field', async () => {
    vi.spyOn(api, 'createCategory').mockRejectedValue(
      httpError(400, { message: ['description must be shorter than or equal to 255 characters'] }),
    );
    render(<CategoryFormModal category={null} onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Snacks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('description must be shorter than or equal to 255 characters'),
    ).toBeInTheDocument();
  });

  it('edit mode starts with the current values and sends a PATCH with the new name', async () => {
    const update = vi.spyOn(api, 'updateCategory').mockResolvedValue();
    const onSaved = vi.fn();
    render(<CategoryFormModal category={keyboards} onClose={vi.fn()} onSaved={onSaved} />);

    expect(screen.getByRole('heading', { name: 'Edit category' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Keyboards');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Keyboards & Mice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith('Category "Keyboards & Mice" updated.'),
    );
    expect(update).toHaveBeenCalledWith(1, {
      name: 'Keyboards & Mice',
      description: 'Wired and wireless keyboards',
    });
  });
});
