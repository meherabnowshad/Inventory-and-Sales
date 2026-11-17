import { FormEvent, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { CategoryItem, createCategory, readApiError, updateCategory } from '../../services/api';

// Limits match the backend DTOs (create-category.dto.ts): name VarChar(80), description VarChar(255)
const NAME_MAX = 80;
const DESCRIPTION_MAX = 255;

interface CategoryFormModalProps {
  category: CategoryItem | null; // null = create mode, a category = edit mode (prefilled)
  onClose: () => void; // user cancelled or closed the form
  onSaved: (message: string) => void; // saved OK; CategoriesPage reloads the list and shows the message
}

// Messages shown under each input; the text names the field (IMS-09.2 done-when)
interface FieldErrors {
  name?: string;
  description?: string;
  form?: string; // anything that does not belong to one field (e.g. network error)
}

// IMS-09.2: create / edit form for a category (FR-CAT-01, FR-CAT-02). Opened from CategoriesPage.
export function CategoryFormModal({ category, onClose, onSaved }: CategoryFormModalProps) {
  const isEdit = category !== null;
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  // Same rules as the backend, so the user sees the problem before sending the request
  const validate = (): FieldErrors => {
    const found: FieldErrors = {};
    const trimmedName = name.trim();
    if (!trimmedName) found.name = 'Name is required';
    else if (trimmedName.length > NAME_MAX)
      found.name = `Name must be ${NAME_MAX} characters or fewer`;
    if (description.length > DESCRIPTION_MAX)
      found.description = `Description must be ${DESCRIPTION_MAX} characters or fewer`;
    return found;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return; // stop here, nothing is sent

    setIsSaving(true);
    const input = { name: name.trim(), description: description.trim() || undefined };
    try {
      if (isEdit) await updateCategory(category.id, input);
      else await createCategory(input);
      onSaved(isEdit ? `Category "${input.name}" updated.` : `Category "${input.name}" created.`);
    } catch (err) {
      const info = readApiError(err);
      const next: FieldErrors = {};
      if (info.code === 'CATEGORY_NAME_TAKEN') {
        // 409 from IMS-08.2: duplicate name, case ignored
        next.name = 'A category with this name already exists (case is ignored)';
      } else if (info.status === 400 && info.messages.length > 0) {
        // 400 from the backend validation: match each message to its field by the field name
        for (const m of info.messages) {
          if (m.toLowerCase().startsWith('name')) next.name = next.name ?? m;
          else if (m.toLowerCase().startsWith('description'))
            next.description = next.description ?? m;
          else next.form = next.form ?? m;
        }
      } else {
        next.form = 'Could not save the category. Please try again.';
      }
      setErrors(next);
    } finally {
      setIsSaving(false);
    }
  };

  // Rendered into document.body (portal) so the dark overlay covers the whole screen, including the
  // sticky page header (z-10); inside the page content it could sit under or beside the header
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-form-title"
    >
      <form
        onSubmit={handleSubmit}
        noValidate
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 id="category-form-title" className="text-lg font-bold text-zinc-900">
            {isEdit ? 'Edit category' : 'Add category'}
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

        {errors.form && (
          <p role="alert" className="text-sm text-rose-700">
            {errors.form}
          </p>
        )}

        <div className="space-y-1">
          <label htmlFor="category-name" className="text-sm font-semibold text-zinc-800">
            Name
          </label>
          <input
            id="category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(errors.name)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800"
          />
          {errors.name && <p className="text-xs text-rose-700">{errors.name}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="category-description" className="text-sm font-semibold text-zinc-800">
            Description (optional)
          </label>
          <textarea
            id="category-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            aria-invalid={Boolean(errors.description)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800"
          />
          {errors.description && <p className="text-xs text-rose-700">{errors.description}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-zinc-300 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-zinc-900 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
