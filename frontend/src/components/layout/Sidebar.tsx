import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Boxes, ShoppingCart, LogIn, Layers, ExternalLink } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const navItems = [
    { label: 'Dashboard', to: '/', icon: LayoutDashboard },
    { label: 'Inventory', to: '/inventory', icon: Boxes },
    { label: 'Sales & Orders', to: '/sales', icon: ShoppingCart },
    { label: 'Authentication', to: '/login', icon: LogIn },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800">
        <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md">
          <Layers className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-white text-base leading-tight">IMS Core</h1>
          <p className="text-[11px] text-slate-400 font-medium">Group 1 • Sprint 1</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1.5">
        <p className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Navigation
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-400 space-y-2">
        <div className="bg-slate-800/80 rounded-md p-2.5">
          <p className="font-semibold text-slate-200 text-[11px]">System Status</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Vite + React Router v6</p>
          <a
            href="http://localhost:5001/api/health"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 mt-2 font-medium"
          >
            <span>API Health Endpoint</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <p className="text-[10px] text-slate-500 text-center">Sprint 1 • IMS-03.2</p>
      </div>
    </aside>
  );
};
