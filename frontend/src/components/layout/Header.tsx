import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { fetchHealth, HealthResponse } from '../../services/api';

export const Header: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    fetchHealth()
      .then((data) => {
        if (isMounted) {
          setHealth(data);
          setIsError(false);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsError(true);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-slate-800">
          Inventory &amp; Sales Management System
        </h2>
        <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
          <ShieldCheck className="w-3 h-3" /> Sprint 1 (Group 1 SRS)
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Backend health status badge */}
        <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border border-slate-200 bg-slate-50">
          <Activity className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-600 font-medium">Backend:</span>
          {loading ? (
            <span className="text-slate-400">Connecting...</span>
          ) : isError ? (
            <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
              <AlertTriangle className="w-3 h-3" /> Standalone (API offline)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
              <CheckCircle2 className="w-3 h-3" /> Connected ({health?.status})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
            M
          </div>
          <div className="hidden md:block text-left text-xs">
            <p className="font-semibold text-slate-700">Meherab (Dev 2)</p>
            <p className="text-slate-500">Inventory Admin</p>
          </div>
        </div>
      </div>
    </header>
  );
};
