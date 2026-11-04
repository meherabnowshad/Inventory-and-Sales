import { useState } from 'react';
import { Plus, Search, Filter, AlertCircle, PackageCheck, AlertTriangle } from 'lucide-react';
import { getStockStatus } from '../utils/stock';

interface MockProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: string;
  stock: number;
  minStock: number;
}

const MOCK_PRODUCTS: MockProduct[] = [
  {
    id: '1',
    sku: 'PRD-001',
    name: 'Wireless Barcode Scanner',
    category: 'Electronics',
    price: '89.99',
    stock: 42,
    minStock: 10,
  },
  {
    id: '2',
    sku: 'PRD-002',
    name: 'Thermal Receipt Printer',
    category: 'Hardware',
    price: '199.50',
    stock: 14,
    minStock: 5,
  },
  {
    id: '3',
    sku: 'PRD-003',
    name: 'Receipt Paper Rolls (Pack of 50)',
    category: 'Supplies',
    price: '34.00',
    stock: 4,
    minStock: 10,
  },
  {
    id: '4',
    sku: 'PRD-004',
    name: 'Heavy Duty Cash Drawer',
    category: 'Hardware',
    price: '120.00',
    stock: 0,
    minStock: 5,
  },
];

export function InventoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeBanner, setActiveBanner] = useState<string | null>(null);

  const filtered = MOCK_PRODUCTS.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Inventory Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor stock levels, product catalog, and SKU tracking (Sprint 1 Baseline).
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setActiveBanner('Product creation modal is scheduled for Sprint 2 (IMS-04).')
          }
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Action Notification Banner */}
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

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by SKU, product, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <button
          type="button"
          onClick={() =>
            setActiveBanner('Advanced multi-criteria filtering will connect to Prisma in Sprint 2.')
          }
          className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 self-stretch sm:self-auto justify-center"
        >
          <Filter className="w-4 h-4 text-slate-500" />
          <span>Filters</span>
        </button>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <AlertTriangle className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800">No matching products found</h3>
            <p className="text-xs text-slate-500">
              No inventory item matches &quot;{searchTerm}&quot;. Try adjusting your search term.
            </p>
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Clear search filter
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Unit Price</th>
                  <th className="py-3 px-4 text-center">Stock</th>
                  <th className="py-3 px-4">Status (Derived)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((product) => {
                  const status = getStockStatus(product.stock, product.minStock);
                  return (
                    <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-700">
                        {product.sku}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900">{product.name}</td>
                      <td className="py-3.5 px-4 text-slate-600">{product.category}</td>
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-900">
                        ${Number(product.price).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-800">
                        {product.stock}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            status === 'In Stock'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : status === 'Low Stock'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {status === 'In Stock' && <PackageCheck className="w-3 h-3" />}
                          {status === 'Low Stock' && <AlertCircle className="w-3 h-3" />}
                          {status === 'Out of Stock' && <AlertTriangle className="w-3 h-3" />}
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
