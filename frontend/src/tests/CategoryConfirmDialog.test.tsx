import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';
import { CategoryConfirmDialog } from '../components/categories/CategoryConfirmDialog';
import * as api from '../services/api';
import type { CategoryItem } from '../services/api';

const keyboards: CategoryItem = {
  id: 1,
  name: 'Keyboards',
  description: null,
  isActive: true,
  productCount: 6,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};
const cables: CategoryItem = { ...keyboards, id: 2, name: 'Cables', productCount: 0 };

// Builds the error axios throws for an HTTP error, so the dialog's catch block runs as in the real app
function httpError(status: number, data: unknown): AxiosError {
  const err = new AxiosError('request failed');
  err.response = { status, data } as AxiosError['response'];
  return err;
}

// Tests for components/categories/CategoryConfirmDialog.tsx (IMS-09.3, FR-CAT-03); API is mocked
describe('CategoryConfirmDialog (IMS-09.3)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Deactivate: shows the confirmation and sends nothing until the user confirms', () => {
    const patch = vi.spyOn(api, 'setCategoryActive').mockResolvedValue();
    render(
      <CategoryConfirmDialog
        category={keyboards}
        action="deactivate"
        onClose={vi.fn()}
        onDone={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Deactivate category?' })).toBeInTheDocument();
    expect(screen.getByText(/"Keyboards" will be marked inactive/)).toHaveTextContent(
      'Its 6 products keep this category.',
    );
    expect(patch).not.toHaveBeenCalled();
  });

  it('Deactivate: leaves out the products sentence when no product uses the category', () => {
    render(
      <CategoryConfirmDialog
        category={cables}
        action="deactivate"
        onClose={vi.fn()}
        onDone={vi.fn()}
      />,
    );

    expect(screen.getByText(/"Cables" will be marked inactive/)).not.toHaveTextContent('keep this');
  });

  it('Deactivate: Cancel closes the dialog and sends nothing', () => {
    const patch = vi.spyOn(api, 'setCategoryActive').mockResolvedValue();
    const onClose = vi.fn();
    render(
      <CategoryConfirmDialog
        category={keyboards}
        action="deactivate"
        onClose={onClose}
        onDone={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });

  it('Deactivate: confirming sends isActive=false and reports success', async () => {
    const patch = vi.spyOn(api, 'setCategoryActive').mockResolvedValue();
    const onDone = vi.fn();
    render(
      <CategoryConfirmDialog
        category={keyboards}
        action="deactivate"
        onClose={vi.fn()}
        onDone={onDone}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith('Category "Keyboards" deactivated.'));
    expect(patch).toHaveBeenCalledWith(1, false);
  });

  it('Deactivate: shows an error and stays open when the request fails', async () => {
    vi.spyOn(api, 'setCategoryActive').mockRejectedValue(httpError(500, { message: 'boom' }));
    const onDone = vi.fn();
    render(
      <CategoryConfirmDialog
        category={keyboards}
        action="deactivate"
        onClose={vi.fn()}
        onDone={onDone}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not deactivate the category');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('Delete: confirming deletes the category and reports success', async () => {
    const del = vi.spyOn(api, 'deleteCategory').mockResolvedValue();
    const onDone = vi.fn();
    render(
      <CategoryConfirmDialog category={cables} action="delete" onClose={vi.fn()} onDone={onDone} />,
    );

    expect(screen.getByRole('heading', { name: 'Delete category?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith('Category "Cables" deleted.'));
    expect(del).toHaveBeenCalledWith(2);
  });

  it('Delete: on 409 CATEGORY_IN_USE offers Deactivate instead, using the product count from the API', async () => {
    vi.spyOn(api, 'deleteCategory').mockRejectedValue(
      httpError(409, { code: 'CATEGORY_IN_USE', message: 'in use', productCount: 3 }),
    );
    const patch = vi.spyOn(api, 'setCategoryActive').mockResolvedValue();
    const onDone = vi.fn();
    render(
      <CategoryConfirmDialog
        category={keyboards}
        action="delete"
        onClose={vi.fn()}
        onDone={onDone}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(
      await screen.findByText('This category is used by 3 products. Deactivate it instead?'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();

    // the Deactivate button of the in-use view does the same as Deactivate on the row
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('Category "Keyboards" deactivated.'));
    expect(patch).toHaveBeenCalledWith(1, false);
  });

  it('Delete: says "1 product" (singular) when the API reports one product', async () => {
    vi.spyOn(api, 'deleteCategory').mockRejectedValue(
      httpError(409, { code: 'CATEGORY_IN_USE', message: 'in use', productCount: 1 }),
    );
    render(
      <CategoryConfirmDialog
        category={keyboards}
        action="delete"
        onClose={vi.fn()}
        onDone={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(
      await screen.findByText('This category is used by 1 product. Deactivate it instead?'),
    ).toBeInTheDocument();
  });

  it('Delete: shows an error and stays open on a 404', async () => {
    vi.spyOn(api, 'deleteCategory').mockRejectedValue(httpError(404, { message: 'not found' }));
    render(
      <CategoryConfirmDialog
        category={cables}
        action="delete"
        onClose={vi.fn()}
        onDone={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('no longer exists');
  });
});
