import { Activity, CheckCircle2, AlertTriangle, ShieldCheck, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useHealthStatus } from '../../hooks/useHealthStatus';
import { useAuth } from '../../context/AuthContext';

export function Header() {
  const { health, loading, error } = useHealthStatus();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-slate-800">SmartMart IMS</h2>
        <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
          <ShieldCheck className="w-3 h-3" /> Sprint 1 (Group 1)
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Backend health status badge */}
        <div
          data-testid="backend-status-badge"
          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border border-slate-200 bg-slate-50"
        >
          <Activity className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-600 font-medium">Backend:</span>
          {loading ? (
            <span className="text-slate-400">Connecting...</span>
          ) : error ? (
            <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
              <AlertTriangle className="w-3 h-3" /> Offline (API unreachable)
            </span>
          ) : health?.status === 'DEGRADED' ? (
            <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
              <AlertTriangle className="w-3 h-3" /> Degraded (DB Offline)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
              <CheckCircle2 className="w-3 h-3" /> Connected (UP)
            </span>
          )}
        </div>

        {/* User profile & quick logout */}
        {user ? (
          <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {user.name.charAt(0)}
              </div>
              <div className="hidden md:block text-left text-xs">
                <p className="font-semibold text-slate-700">{user.name}</p>
                <p className="text-slate-400 text-[10px] uppercase font-semibold">{user.role}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            Sign In
          </button>
        )}
      </div>
    </header>
  );
}
