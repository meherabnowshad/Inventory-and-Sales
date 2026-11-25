import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Ban, Loader2, Pencil, Plus, Users } from 'lucide-react';
import { StaffConfirmDialog } from '../components/staff/StaffConfirmDialog';
import { StaffFormModal } from '../components/staff/StaffFormModal';
import { useAuth } from '../context/AuthContext';
import { fetchStaff, StaffStatusFilter, StaffUser } from '../services/api';
import { UserRole } from '../types/auth';

const PAGE_SIZE = 20;
const ROLES: UserRole[] = ['Administrator', 'Sales Staff', 'Store Staff'];
const FILTERS: { value: StaffStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];
const OWN_ACCOUNT_ERROR = 'You cannot change your own role or deactivate your own account.';

export function StaffPage() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [status, setStatus] = useState<StaffStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formTarget, setFormTarget] = useState<StaffUser | 'new' | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<StaffUser | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    fetchStaff({
      q: debouncedSearch,
      role: role || undefined,
      status,
      page,
      size: PAGE_SIZE,
    })
      .then((response) => {
        if (active) {
          setStaff(response.items);
          setTotal(response.total);
        }
      })
      .catch(() => {
        if (active) setError('Could not load staff. Please try again.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedSearch, role, status, page, reloadKey]);

  const handleSaved = useCallback((message: string) => {
    setFormTarget(null);
    setNotice(message);
    setReloadKey((key) => key + 1);
  }, []);

  const handleConfirmed = useCallback((message: string) => {
    setConfirmTarget(null);
    setNotice(message);
    setReloadKey((key) => key + 1);
  }, []);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const firstItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Staff</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage staff accounts and roles.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setNotice(null);
            setFormTarget('new');
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-black text-white rounded-lg text-sm font-semibold shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Staff</span>
        </button>
      </div>

      {notice && (
        <div
          role="status"
          className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-sm text-emerald-800"
        >
          {notice}
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <label htmlFor="staff-search" className="text-sm font-semibold text-zinc-800">
            Search staff
          </label>
          <input
            id="staff-search"
            type="search"
            placeholder="Search name, username, or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full sm:w-80 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="staff-role-filter" className="text-sm font-semibold text-zinc-800">
            Filter by role
          </label>
          <select
            id="staff-role-filter"
            value={role}
            onChange={(event) => {
              setRole(event.target.value as UserRole | '');
              setPage(1);
            }}
            className="w-full sm:w-56 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800"
          >
            <option value="">All roles</option>
            {ROLES.map((staffRole) => (
              <option key={staffRole} value={staffRole}>
                {staffRole}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        role="group"
        aria-label="Filter by status"
        className="inline-flex rounded-lg border border-zinc-300 bg-white p-1 shadow-sm"
      >
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            aria-pressed={status === filter.value}
            onClick={() => {
              setStatus(filter.value);
              setPage(1);
            }}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
              status === filter.value ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex items-center justify-center gap-2 text-sm text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading staff...</span>
          </div>
        ) : error ? (
          <div role="alert" className="p-12 text-center space-y-2">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-sm font-semibold text-zinc-800">{error}</p>
          </div>
        ) : staff.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Users className="w-8 h-8 text-zinc-400 mx-auto" />
            <p className="text-sm font-semibold text-zinc-800">No staff match your search.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-100/80 text-zinc-700 border-b border-zinc-200 text-xs uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {staff.map((member) => {
                  const isOwnAccount = String(user?.id) === String(member.id);
                  return (
                    <tr key={member.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-zinc-900">{member.name}</td>
                      <td className="py-3.5 px-4 text-zinc-600">{member.username}</td>
                      <td className="py-3.5 px-4 text-zinc-600">{member.email}</td>
                      <td className="py-3.5 px-4 text-zinc-600">{member.role}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            member.isActive
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                              : 'bg-zinc-100 text-zinc-600 border border-zinc-300'
                          }`}
                        >
                          {member.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => {
                              setNotice(null);
                              setFormTarget(member);
                            }}
                            aria-label={`Edit ${member.name}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-700 hover:text-black underline"
                          >
                            <Pencil className="w-3 h-3" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNotice(null);
                              setConfirmTarget(member);
                            }}
                            aria-label={`${
                              member.isActive ? 'Deactivate' : 'Reactivate'
                            } ${member.name}`}
                            title={isOwnAccount && member.isActive ? OWN_ACCOUNT_ERROR : undefined}
                            disabled={isOwnAccount && member.isActive}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-700 hover:text-black underline disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {member.isActive ? (
                              <Ban className="w-3 h-3" />
                            ) : (
                              <span className="w-3 h-3" aria-hidden="true">
                                +
                              </span>
                            )}
                            {member.isActive ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && !error && (
          <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-sm text-zinc-600">
            <span>
              Showing {firstItem}-{lastItem} of {total}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
                className="px-3 py-1.5 rounded-lg border border-zinc-300 font-semibold hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                aria-label="Next page"
                className="px-3 py-1.5 rounded-lg border border-zinc-300 font-semibold hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {formTarget !== null && (
        <StaffFormModal
          staff={formTarget === 'new' ? null : formTarget}
          isOwnAccount={formTarget !== 'new' && String(user?.id) === String(formTarget.id)}
          onClose={() => setFormTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {confirmTarget !== null && (
        <StaffConfirmDialog
          staff={confirmTarget}
          onClose={() => setConfirmTarget(null)}
          onDone={handleConfirmed}
        />
      )}
    </div>
  );
}
