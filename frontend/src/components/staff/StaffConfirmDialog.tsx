import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { readApiError, StaffUser, updateStaff } from '../../services/api';

interface StaffConfirmDialogProps {
  staff: StaffUser;
  onClose: () => void;
  onDone: (message: string) => void;
}

const OWN_ACCOUNT_ERROR = 'You cannot change your own role or deactivate your own account.';
const ADMIN_ERROR = 'At least one active Administrator is required.';

export function StaffConfirmDialog({ staff, onClose, onDone }: StaffConfirmDialogProps) {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shouldActivate = !staff.isActive;
  const action = shouldActivate ? 'Reactivate' : 'Deactivate';

  const handleConfirm = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await updateStaff(staff.id, { isActive: shouldActivate });
      onDone(`Staff account "${staff.name}" ${shouldActivate ? 'reactivated' : 'deactivated'}.`);
    } catch (requestError: unknown) {
      const code = readApiError(requestError).code;
      if (code === 'CANNOT_MODIFY_OWN_ACCOUNT') setError(OWN_ACCOUNT_ERROR);
      else if (code === 'LAST_ADMIN') setError(ADMIN_ERROR);
      else
        setError(
          `Could not ${shouldActivate ? 'reactivate' : 'deactivate'} the staff account. Please try again.`,
        );
    } finally {
      setIsBusy(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-confirm-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="staff-confirm-title" className="text-lg font-bold text-zinc-900">
            {action} staff account?
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

        <p className="text-sm text-zinc-700">
          &quot;{staff.name}&quot; will be marked {shouldActivate ? 'active' : 'inactive'}.
        </p>

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
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isBusy}
            className="px-4 py-2 rounded-lg bg-zinc-900 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
          >
            {isBusy ? (shouldActivate ? 'Reactivating...' : 'Deactivating...') : action}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
