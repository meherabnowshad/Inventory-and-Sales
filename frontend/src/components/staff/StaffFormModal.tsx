import { FormEvent, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, X } from 'lucide-react';
import { createStaff, readApiError, StaffUser, updateStaff } from '../../services/api';
import { UserRole } from '../../types/auth';

interface StaffFormModalProps {
  staff: StaffUser | null;
  isOwnAccount?: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}

interface FieldErrors {
  name?: string;
  username?: string;
  email?: string;
  role?: string;
  temporaryPassword?: string;
  form?: string;
}

const ROLES: UserRole[] = ['Administrator', 'Sales Staff', 'Store Staff'];
const OWN_ACCOUNT_ERROR = 'You cannot change your own role or deactivate your own account.';
const ADMIN_ERROR = 'At least one active Administrator is required.';

export function StaffFormModal({
  staff,
  isOwnAccount = false,
  onClose,
  onSaved,
}: StaffFormModalProps) {
  const isEdit = staff !== null;
  const [name, setName] = useState(staff?.name ?? '');
  const [username, setUsername] = useState(staff?.username ?? '');
  const [email, setEmail] = useState(staff?.email ?? '');
  const [role, setRole] = useState<UserRole | ''>(staff?.role ?? '');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  const validate = (): FieldErrors => {
    const found: FieldErrors = {};
    const trimmedName = name.trim();
    const trimmedUsername = username.trim();
    if (!trimmedName) found.name = 'Name is required';
    else if (trimmedName.length > 120) found.name = 'Name must be 120 characters or fewer';

    if (!isEdit) {
      if (!trimmedUsername) found.username = 'Username is required';
      else if (
        trimmedUsername.length < 3 ||
        trimmedUsername.length > 40 ||
        !/^[A-Za-z0-9._-]+$/.test(trimmedUsername)
      ) {
        found.username = 'Username must be 3-40 characters (letters, digits, . _ -)';
      }
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      found.email = 'Enter a valid email address';
    if (!role) found.role = 'Select a role';
    if (!isEdit && temporaryPassword.length < 8)
      found.temporaryPassword = 'Temporary password must be at least 8 characters';
    return found;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setIsSaving(true);
    try {
      const trimmedName = name.trim();
      const trimmedEmail = email.trim();
      if (isEdit) {
        await updateStaff(staff.id, {
          name: trimmedName,
          email: trimmedEmail,
          ...(!isOwnAccount ? { role: role as UserRole } : {}),
        });
        onSaved('Staff account updated.');
      } else {
        await createStaff({
          name: trimmedName,
          username: username.trim(),
          email: trimmedEmail,
          role: role as UserRole,
          temporaryPassword,
        });
        onSaved('The user must set a new password at first login.');
      }
    } catch (error: unknown) {
      const info = readApiError(error);
      const next: FieldErrors = {};
      if (info.code === 'USERNAME_TAKEN') next.username = 'This username is already taken';
      else if (info.code === 'EMAIL_TAKEN') next.email = 'This email is already used';
      else if (info.code === 'CANNOT_MODIFY_OWN_ACCOUNT') next.form = OWN_ACCOUNT_ERROR;
      else if (info.code === 'LAST_ADMIN') next.form = ADMIN_ERROR;
      else next.form = 'Could not save the staff account. Please try again.';
      setErrors(next);
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-form-title"
    >
      <form
        onSubmit={handleSubmit}
        noValidate
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 id="staff-form-title" className="text-lg font-bold text-zinc-900">
            {isEdit ? 'Edit staff account' : 'Add staff'}
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
          <label htmlFor="staff-name" className="text-sm font-semibold text-zinc-800">
            Name
          </label>
          <input
            id="staff-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={Boolean(errors.name)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800"
          />
          {errors.name && <p className="text-xs text-rose-700">{errors.name}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="staff-username" className="text-sm font-semibold text-zinc-800">
            Username
          </label>
          <input
            id="staff-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            readOnly={isEdit}
            aria-invalid={Boolean(errors.username)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800 read-only:bg-zinc-100"
          />
          {errors.username && <p className="text-xs text-rose-700">{errors.username}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="staff-email" className="text-sm font-semibold text-zinc-800">
            Email
          </label>
          <input
            id="staff-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(errors.email)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800"
          />
          {errors.email && <p className="text-xs text-rose-700">{errors.email}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="staff-role" className="text-sm font-semibold text-zinc-800">
            Role
          </label>
          <select
            id="staff-role"
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole | '')}
            disabled={isOwnAccount}
            title={isOwnAccount ? OWN_ACCOUNT_ERROR : undefined}
            aria-invalid={Boolean(errors.role)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800 disabled:bg-zinc-100 disabled:text-zinc-500"
          >
            <option value="">Select a role</option>
            {ROLES.map((staffRole) => (
              <option key={staffRole} value={staffRole}>
                {staffRole}
              </option>
            ))}
          </select>
          {errors.role && <p className="text-xs text-rose-700">{errors.role}</p>}
        </div>

        {!isEdit && (
          <div className="space-y-1">
            <label
              htmlFor="staff-temporary-password"
              className="text-sm font-semibold text-zinc-800"
            >
              Temporary password
            </label>
            <div className="relative">
              <input
                id="staff-temporary-password"
                type={showPassword ? 'text' : 'password'}
                value={temporaryPassword}
                onChange={(event) => setTemporaryPassword(event.target.value)}
                aria-invalid={Boolean(errors.temporaryPassword)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800"
              />
              <button
                type="button"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? 'Hide temporary password' : 'Show temporary password'}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500 hover:text-zinc-800"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.temporaryPassword && (
              <p className="text-xs text-rose-700">{errors.temporaryPassword}</p>
            )}
          </div>
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
