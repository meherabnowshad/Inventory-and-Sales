import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Tags } from 'lucide-react';
import { CategoryItem, CategoryStatusFilter, fetchCategories } from '../services/api';

// Buttons of the filter; "value" is sent to the backend as ?status= (FR-CAT-04, IMS-08.4)
const FILTERS: { value: CategoryStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

// IMS-09.1: category list with product counts and an active/inactive filter.
// Route /categories is added in App.tsx; create/edit (09.2) and deactivate (09.3) come later.
export function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]); // rows shown in the table
  const [status, setStatus] = useState<CategoryStatusFilter>('all'); // selected filter button
  const [isLoading, setIsLoading] = useState(true); // true while a request is running
  const [error, setError] = useState<string | null>(null); // message shown when the request fails

  // Runs on first render and every time the filter changes; asks the API for the matching rows
  useEffect(() => {
    let active = true; // set to false on cleanup so a slow old response cannot overwrite a newer one
    setIsLoading(true);
    setError(null);
    fetchCategories(status)
      .then((data) => {
        if (active) setCategories(data);
      })
      .catch(() => {
        if (active) setError('Could not load categories. Please try again.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [status]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Categories</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Product categories with the number of products in each.
        </p>
      </div>

      {/* Filter: All / Active / Inactive */}
      <div
        role="group"
        aria-label="Filter by status"
        className="inline-flex rounded-lg border border-zinc-300 bg-white p-1 shadow-sm"
      >
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={status === f.value}
            onClick={() => setStatus(f.value)}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
              status === f.value ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex items-center justify-center gap-2 text-sm text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading categories...</span>
          </div>
        ) : error ? (
          <div role="alert" className="p-12 text-center space-y-2">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-sm font-semibold text-zinc-800">{error}</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Tags className="w-8 h-8 text-zinc-400 mx-auto" />
            <h3 className="text-sm font-semibold text-zinc-800">No categories found</h3>
            <p className="text-xs text-zinc-500">
              {status === 'all'
                ? 'There are no categories yet.'
                : `There are no ${status} categories.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-100/80 text-zinc-700 border-b border-zinc-200 text-xs uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center">Products</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {categories.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-zinc-900">{c.name}</td>
                    <td className="py-3.5 px-4 text-zinc-600">{c.description || '-'}</td>
                    <td className="py-3.5 px-4 text-center font-semibold text-zinc-800">
                      {c.productCount}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          c.isActive
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                            : 'bg-zinc-100 text-zinc-600 border border-zinc-300'
                        }`}
                      >
                        {c.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
