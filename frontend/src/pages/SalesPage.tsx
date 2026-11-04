import React from 'react';
import { Plus, Receipt, Calendar, CreditCard } from 'lucide-react';

interface MockSale {
  id: string;
  orderNumber: string;
  customer: string;
  itemsCount: number;
  total: number;
  date: string;
  paymentMethod: string;
  status: 'Completed' | 'Pending' | 'Refunded';
}

export const SalesPage: React.FC = () => {
  const mockSales: MockSale[] = [
    {
      id: '1',
      orderNumber: 'ORD-2026-001',
      customer: 'Walk-in Customer',
      itemsCount: 3,
      total: 145.5,
      date: 'Today, 10:24 AM',
      paymentMethod: 'Credit Card',
      status: 'Completed',
    },
    {
      id: '2',
      orderNumber: 'ORD-2026-002',
      customer: 'Apex Retail Supplies',
      itemsCount: 12,
      total: 1240.0,
      date: 'Today, 09:15 AM',
      paymentMethod: 'Bank Transfer',
      status: 'Completed',
    },
    {
      id: '3',
      orderNumber: 'ORD-2026-003',
      customer: 'Sarah Jenkins',
      itemsCount: 1,
      total: 89.99,
      date: 'Yesterday, 04:50 PM',
      paymentMethod: 'Cash',
      status: 'Completed',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sales &amp; Orders</h1>
          <p className="text-sm text-slate-500 mt-1">
            Point of Sale records, transactions, and order fulfillment.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Sale Entry</span>
        </button>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-800">Recent Transactions</h2>
          </div>
          <span className="text-xs text-slate-500">Showing {mockSales.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Date / Time</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mockSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-700">
                    {sale.orderNumber}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-900">{sale.customer}</td>
                  <td className="py-3.5 px-4 text-slate-500 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{sale.date}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 text-xs">
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                      <span>{sale.paymentMethod}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center font-semibold text-slate-700">
                    {sale.itemsCount}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                    ${sale.total.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
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
};
