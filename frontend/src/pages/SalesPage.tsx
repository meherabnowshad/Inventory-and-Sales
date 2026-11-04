import { useState } from 'react';
import { Plus, Receipt, Calendar, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface MockSale {
  id: string;
  saleNumber: string;
  itemsCount: number;
  totalAmount: string;
  taxAmount: string;
  date: string;
  status: 'COMPLETED' | 'PENDING' | 'CANCELLED';
}

const MOCK_SALES: MockSale[] = [
  {
    id: '1',
    saleNumber: 'INV-2026-0001',
    itemsCount: 3,
    totalAmount: '145.50',
    taxAmount: '7.28',
    date: 'Today, 10:24 AM',
    status: 'COMPLETED',
  },
  {
    id: '2',
    saleNumber: 'INV-2026-0002',
    itemsCount: 12,
    totalAmount: '1240.00',
    taxAmount: '62.00',
    date: 'Today, 09:15 AM',
    status: 'PENDING',
  },
  {
    id: '3',
    saleNumber: 'INV-2026-0003',
    itemsCount: 1,
    totalAmount: '89.99',
    taxAmount: '4.50',
    date: 'Yesterday, 04:50 PM',
    status: 'CANCELLED',
  },
];

export function SalesPage() {
  const [activeBanner, setActiveBanner] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sales &amp; Orders</h1>
          <p className="text-sm text-slate-500 mt-1">
            Point of Sale records, transactions, and order fulfillment (All monetary figures in BDT
            · BR-13).
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setActiveBanner(
              'POS Transaction flow and receipt printer integration planned for Sprint 2.',
            )
          }
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Sale Entry</span>
        </button>
      </div>

      {activeBanner && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-700 flex items-center justify-between">
          <span>{activeBanner}</span>
          <button
            type="button"
            onClick={() => setActiveBanner(null)}
            className="font-bold ml-4 hover:text-indigo-900"
          >
            ✕
          </button>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-800">Recent Transactions</h2>
          </div>
          <span className="text-xs text-slate-500">Showing {MOCK_SALES.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Sale Number</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4 text-right">Tax (BDT)</th>
                <th className="py-3 px-4 text-right">Total (BDT)</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MOCK_SALES.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-700">
                    {sale.saleNumber}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{sale.date}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center font-semibold text-slate-700">
                    {sale.itemsCount}
                  </td>
                  <td className="py-3.5 px-4 text-right font-medium text-slate-500">
                    BDT {Number(sale.taxAmount).toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                    BDT {Number(sale.totalAmount).toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        sale.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : sale.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {sale.status === 'COMPLETED' && <CheckCircle2 className="w-3 h-3" />}
                      {sale.status === 'PENDING' && <Clock className="w-3 h-3" />}
                      {sale.status === 'CANCELLED' && <XCircle className="w-3 h-3" />}
                      {sale.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
