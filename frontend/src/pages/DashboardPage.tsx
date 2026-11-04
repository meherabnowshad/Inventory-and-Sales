import { Package, TrendingUp, AlertTriangle, DollarSign, CheckCircle2 } from 'lucide-react';
import { useHealthStatus } from '../hooks/useHealthStatus';

const MOCK_METRICS = [
  {
    title: 'Total Products (Mock)',
    value: '1,280',
    change: 'Sprint 1 placeholder dataset',
    icon: Package,
    color: 'bg-blue-500',
  },
  {
    title: "Today's Sales (Mock)",
    value: 'BDT 4,850.00',
    change: 'Sprint 1 placeholder dataset',
    icon: TrendingUp,
    color: 'bg-emerald-500',
  },
  {
    title: 'Low Stock Alerts (Mock)',
    value: '7 Items',
    change: 'Sprint 1 placeholder dataset',
    icon: AlertTriangle,
    color: 'bg-amber-500',
  },
  {
    title: 'Total Revenue (Mock)',
    value: 'BDT 94,320.00',
    change: 'Sprint 1 placeholder dataset',
    icon: DollarSign,
    color: 'bg-indigo-500',
  },
];

export function DashboardPage() {
  const { health, loading, error } = useHealthStatus();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Overview Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Welcome to the Inventory and Sales Management System (Group 1 SRS baseline).
          </p>
        </div>
        <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3 py-1.5 rounded-md font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Sprint 1 Skeleton Initialized</span>
        </div>
      </div>

      {/* Metric Cards (Labeled as Mock Baseline) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {MOCK_METRICS.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.title}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow transition-shadow"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {m.title}
                </span>
                <div className={`p-2 rounded-lg text-white ${m.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-3">{m.value}</p>
              <p className="text-xs text-slate-400 mt-1">{m.change}</p>
            </div>
          );
        })}
      </div>

      {/* Architecture & Verification Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Sprint 1 Non-Functional Requirements
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Core deliverables tracking for Sprint 1 kick-off.
          </p>

          <div className="mt-4 space-y-3">
            <div className="p-3.5 rounded-lg border border-slate-100 bg-slate-50 flex items-start gap-3">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 text-indigo-700 shrink-0">
                NFR-OPS-01
              </span>
              <div>
                <p className="text-sm font-medium text-slate-800">Single-Command Startup</p>
                <p className="text-xs text-slate-500">
                  Backend (<code className="bg-slate-200 px-1 rounded">npm run dev:backend</code>)
                  and Frontend (
                  <code className="bg-slate-200 px-1 rounded">npm run dev:frontend</code>) or both
                  concurrently via <code className="bg-slate-200 px-1 rounded">npm run dev</code>.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg border border-slate-100 bg-slate-50 flex items-start gap-3">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-700 shrink-0">
                NFR-SEC-03
              </span>
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Security &amp; Secret Isolation
                </p>
                <p className="text-xs text-slate-500">
                  Environment variables configured via Zod validated schemas, no committed secrets,
                  CORS origin trimming, and helmet security headers.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg border border-slate-100 bg-slate-50 flex items-start gap-3">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-700 shrink-0">
                NFR-MNT-01
              </span>
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Maintainability &amp; Code Quality
                </p>
                <p className="text-xs text-slate-500">
                  Strict ESLint and Prettier rules with TypeScript strict mode, Vitest unit &amp;
                  integration tests, PR template enforcement, and CI branch protection.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Live API Health Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Backend Live Status</h2>
            <p className="text-xs text-slate-500 mt-1">Live response from Express backend</p>

            <div className="mt-4 p-4 rounded-lg bg-slate-900 text-slate-100 text-xs font-mono overflow-auto max-h-52">
              {loading ? (
                <p className="text-slate-400">Connecting to /api/health...</p>
              ) : health ? (
                <pre>{JSON.stringify(health, null, 2)}</pre>
              ) : (
                <p className="text-amber-400">
                  Backend offline or unreachable ({error || 'Network Error'}).
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
            Assigned: <span className="font-semibold text-slate-700">Meherab (Dev 2)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
