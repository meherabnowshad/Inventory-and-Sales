import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Boxes, ShoppingCart, Layers, LogOut, Shield, Tags } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/auth';

interface NavItemConfig {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  allowedRoles: UserRole[];
}

// FR-AUTH-07 & SRS Permission Matrix (Section 2)
const ALL_NAV_ITEMS: NavItemConfig[] = [
  {
    label: 'Dashboard',
    to: '/',
    icon: LayoutDashboard,
    allowedRoles: ['Administrator'],
  },
  {
    label: 'Inventory',
    to: '/inventory',
    icon: Boxes,
    allowedRoles: ['Administrator', 'Sales Staff', 'Store Staff'],
  },
  {
    label: 'Categories',
    to: '/categories',
    icon: Tags,
    allowedRoles: ['Administrator', 'Sales Staff', 'Store Staff'],
  },
  {
    label: 'Sales & Orders',
    to: '/sales',
    icon: ShoppingCart,
    allowedRoles: ['Administrator', 'Sales Staff'],
  },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // FR-AUTH-07: Filter items outside the role
  const visibleNavItems = ALL_NAV_ITEMS.filter((item) =>
    user ? item.allowedRoles.includes(user.role) : false,
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="w-64 bg-[#14171c] text-zinc-300 flex flex-col shrink-0 min-h-screen border-r border-zinc-800/80">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-zinc-800/90">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 flex items-center justify-center text-zinc-100 shadow-md border border-zinc-700/60">
          <Layers className="w-5 h-5 text-zinc-200" />
        </div>
        <div>
          <h1 className="font-bold text-white text-base leading-tight">SmartMart</h1>
        </div>
      </div>

      {/* User Role Card */}
      {user && (
        <div className="mx-3 mt-4 p-3 rounded-xl bg-zinc-900/90 border border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-200 flex items-center justify-center font-bold text-xs border border-zinc-700 shadow-inner">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-zinc-200 truncate">{user.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Shield className="w-3 h-3 text-zinc-400 shrink-0" />
                <span className="text-[10px] font-semibold text-zinc-400 truncate">
                  {user.role}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation (Filtered by role - FR-AUTH-07) */}
      <nav aria-label="Role Navigation" className="flex-1 px-3 py-4 space-y-1.5">
        <p className="px-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
          Navigation
        </p>
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-zinc-800 to-zinc-850 text-white shadow-sm border border-zinc-700/80 font-semibold'
                    : 'text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-100'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Logout button (FR-AUTH-02) */}
      <div className="p-3 border-t border-zinc-800/80">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:bg-zinc-900 hover:text-rose-400 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-zinc-500 group-hover:text-rose-400" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* System Status Footer */}
      {/* <div className="p-3 border-t border-zinc-800/80 text-xs text-zinc-400 space-y-2">
        <div className="bg-zinc-900/60 border border-zinc-800/70 rounded-md p-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-zinc-300">RBAC System</span>
            <span className="text-emerald-400 font-medium">Active</span>
          </div>
          <a
            href="/api/health"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 mt-1 font-medium"
          >
            <span>API Health</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div> */}
    </aside>
  );
}
