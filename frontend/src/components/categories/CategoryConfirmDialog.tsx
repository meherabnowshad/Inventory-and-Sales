import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { CategoryItem, deleteCategory, readApiError, setCategoryActive } from '../../services/api';

// 'in-use' is the Delete dialog after the API answered 409 CATEGORY_IN_USE: only Deactivate is offered
type DialogView = 'deactivate' | 'delete' | 'in-use';

interface CategoryConfirmDialogProps {
  category: CategoryItem; // the row whose Deactivate or Delete button was clicked
  action: 'deactivate' | 'delete'; // which button opened the dialog
  onClose: () => void; // user cancelled or closed it; CategoriesPage hides the dialog
  onDone: (message: string) => void; // success; CategoriesPage reloads the list and shows the message
}

// "1 product" / "6 products"
const products = (n: number) => `${n} product${n === 1 ? '' : 's'}`;

// IMS-09.3: confirm dialog for Deactivate and Delete (FR-CAT-03). Opened from CategoriesPage.
export function CategoryConfirmDialog({
  category,
  action,
  onClose,
  onDone,
}: CategoryConfirmDialogProps) {
  const [view, setView] = useState<DialogView>(action);
  const [inUseCount, setInUseCount] = useState(category.productCount); // from the 409 body
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Message for failures other than 409 CATEGORY_IN_USE
  const failureMessage = (status: number | undefined, verb: string) =>
    status === 404
      ? 'This category no longer exists. Close this window; the list will refresh.'
      : `Could not ${verb} the category. Please try again.`;

  // Confirm in Deactivate view, and the Deactivate button of the in-use view: PATCH isActive=false
  const handleDeactivate = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await setCategoryActive(category.id, false);
      onDone(`Category "${category.name}" deactivated.`);
    } catch (err) {
      setError(failureMessage(readApiError(err).status, 'deactivate'));
    } finally {
      setIsBusy(false);
    }
  };

  // Confirm in Delete view: DELETE; a 409 CATEGORY_IN_USE switches to the in-use view
  const handleDelete = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await deleteCategory(category.id);
      onDone(`Category "${category.name}" deleted.`);
    } catch (err) {
      const info = readApiError(err);
      if (info.code === 'CATEGORY_IN_USE') {
        setInUseCount(info.productCount ?? category.productCount);
        setView('in-use');
      } else {
        setError(failureMessage(info.status, 'delete'));
      }
    } finally {
      setIsBusy(false);
    }
  };

  const title =
    view === 'deactivate'
      ? 'Deactivate category?'
      : view === 'delete'
        ? 'Delete category?'
        : 'Category is in use';

  // Same portal and overlay as CategoryFormModal, so the dark layer covers the sticky page header
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-confirm-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="category-confirm-title" className="text-lg font-bold text-zinc-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-zinc-400 hover:text-zinc-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {view === 'deactivate' && (
          <p className="text-sm text-zinc-700">
            &quot;{category.name}&quot; will be marked inactive and cannot be picked for new
            products.
            {category.productCount > 0 &&
              ` Its ${products(category.productCount)} keep this category.`}
          </p>
        )}
        {view === 'delete' && (
          <p className="text-sm text-zinc-700">
            &quot;{category.name}&quot; will be deleted permanently. This cannot be undone.
          </p>
        )}
        {view === 'in-use' && (
          <p className="text-sm text-zinc-700">
            This category is used by {products(inUseCount)}. Deactivate it instead?
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-zinc-300 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            Cancel
          </button>
          {view === 'delete' ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isBusy}
              className="px-4 py-2 rounded-lg bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {isBusy ? 'Deleting...' : 'Delete'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDeactivate}
              disabled={isBusy}
              className="px-4 py-2 rounded-lg bg-zinc-900 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
            >
              {isBusy ? 'Deactivating...' : 'Deactivate'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
