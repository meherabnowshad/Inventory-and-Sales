import React, { useState } from 'react';
import { Plus, Search, Filter, AlertCircle } from 'lucide-react';

interface MockProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

export const InventoryPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const mockProducts: MockProduct[] = [
    {
      id: '1',
      sku: 'PRD-001',
      name: 'Wireless Barcode Scanner',
      category: 'Electronics',
      price: 89.99,
      stock: 42,
      status: 'In Stock',
    },
    {
      id: '2',
      sku: 'PRD-002',
      name: 'Thermal Receipt Printer',
      category: 'Hardware',
      price: 199.5,
      stock: 14,
      status: 'In Stock',
    },
    {
      id: '3',
      sku: 'PRD-003',
      name: 'Receipt Paper Rolls (Pack of 50)',
      category: 'Supplies',
      price: 34.0,
      stock: 4,
      status: 'Low Stock',
    },
    {
      id: '4',
      sku: 'PRD-004',
      name: 'Heavy Duty Cash Drawer',
      category: 'Hardware',
      price: 120.0,
      stock: 0,
      status: 'Out of Stock',
    },
  ];

  const filtered = mockProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Inventory Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor stock levels, product catalog, and SKU tracking.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by SKU or Product name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 self-stretch sm:self-auto justify-center"
        >
          <Filter className="w-4 h-4 text-slate-500" />
          <span>Filters</span>
        </button>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 px-4 text-center">Stock</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-700">
                    {product.sku}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-900">{product.name}</td>
                  <td className="py-3.5 px-4 text-slate-600">{product.category}</td>
                  <td className="py-3.5 px-4 text-right font-semibold text-slate-900">
                    ${product.price.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 text-center font-semibold text-slate-800">
                    {product.stock}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        product.status === 'In Stock'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : product.status === 'Low Stock'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {product.status === 'Low Stock' && <AlertCircle className="w-3 h-3" />}
                      {product.status}
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
