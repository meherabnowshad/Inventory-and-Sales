import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="h-16 bg-white/95 backdrop-blur border-b border-zinc-200 px-6 flex items-center justify-between sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-zinc-900 tracking-tight">SmartMart</h2>
      </div>

      <div className="flex items-center gap-4">
        {/* User profile & quick logout */}
        {user ? (
          <div className="flex items-center gap-3 pl-2 border-l border-zinc-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-800 to-black text-zinc-100 flex items-center justify-center font-bold text-xs shadow-sm border border-zinc-700">
                {user.name.charAt(0)}
              </div>
              <div className="hidden md:block text-left text-xs">
                <p className="font-semibold text-zinc-800">{user.name}</p>
                <p className="text-zinc-400 text-[10px] uppercase font-semibold">{user.role}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="text-xs font-semibold text-zinc-800 hover:text-black"
          >
            Sign In
          </button>
        )}
      </div>
    </header>
  );
}
