import { ShieldAlert, ArrowRight, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function NoAccessPage() {
  const { user, logout } = useAuth();

  // Role default landing screens (FR-AUTH-01 & Gherkin scenarios)
  const homePath =
    user?.role === 'Sales Staff' ? '/sales' : user?.role === 'Store Staff' ? '/inventory' : '/';

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 py-12">
      <div className="w-16 h-16 rounded-2xl bg-zinc-100 border border-zinc-300 text-zinc-700 flex items-center justify-center mb-6 shadow-sm">
        <ShieldAlert className="w-9 h-9 text-rose-600" />
      </div>

      <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 rounded-full mb-3">
        403 Forbidden
      </span>

      <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">Access Denied</h1>

      <p className="mt-3 text-sm text-zinc-600 max-w-md mx-auto leading-relaxed">
        You do not have permission to access this screen. This module is restricted according to
        your assigned role in the system.
      </p>

      {user && (
        <div className="mt-5 inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-zinc-100 border border-zinc-200 text-xs">
          <span className="text-zinc-500">Logged in as:</span>
          <span className="font-semibold text-zinc-800">{user.name}</span>
          <span className="px-2 py-0.5 rounded-md bg-zinc-200 text-zinc-800 border border-zinc-300 font-semibold">
            {user.role}
          </span>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          to={homePath}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-zinc-900 to-zinc-800 hover:from-black hover:to-zinc-900 text-white text-sm font-semibold shadow-sm transition-all"
        >
          <span>Return to Your Home Screen</span>
          <ArrowRight className="w-4 h-4" />
        </Link>

        <button
          onClick={() => logout()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-300 hover:bg-zinc-100 text-zinc-700 text-sm font-semibold transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-zinc-500" />
          <span>Log Out</span>
        </button>
      </div>

      <p className="mt-8 text-xs text-zinc-400">
        Enforced by FR-AUTH-07 • Role-Based Access Control (RBAC)
      </p>
    </div>
  );
}
