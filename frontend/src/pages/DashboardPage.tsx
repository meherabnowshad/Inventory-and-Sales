import { Package, TrendingUp, AlertTriangle, Banknote } from 'lucide-react';

const MOCK_METRICS = [
  {
    title: 'Total Products (Mock)',
    value: '1,280',
    // change: 'Sprint 1 placeholder dataset',
    icon: Package,
    color: 'bg-zinc-800 text-zinc-100 shadow-sm',
  },
  {
    title: "Today's Sales (Mock)",
    value: 'BDT 4,850.00',
    // change: 'Sprint 1 placeholder dataset',
    icon: TrendingUp,
    color: 'bg-zinc-700 text-zinc-100 shadow-sm',
  },
  {
    title: 'Low Stock Alerts (Mock)',
    value: '7 Items',
    // change: 'Sprint 1 placeholder dataset',
    icon: AlertTriangle,
    color: 'bg-amber-600 text-white shadow-sm',
  },
  {
    title: 'Total Revenue (Mock)',
    value: 'BDT 94,320.00',
    // change: 'Sprint 1 placeholder dataset',
    icon: Banknote,
    color: 'bg-zinc-950 text-zinc-100 shadow-sm',
  },
];

export function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Overview Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Welcome to the Inventory and Sales Management System .
          </p>
        </div>
        {/* <div className="inline-flex items-center gap-2 bg-zinc-100 border border-zinc-300 text-zinc-800 text-xs px-3 py-1.5 rounded-md font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Sprint 1 Skeleton Initialized</span>
        </div> */}
      </div>

      {/* Metric Cards (Labeled as Mock Baseline) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {MOCK_METRICS.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.title}
              className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm hover:shadow-md hover:border-zinc-300 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  {m.title}
                </span>
                <div className={`p-2 rounded-lg ${m.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-zinc-900 mt-3">{m.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
