import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryPage } from '../pages/InventoryPage';
import { getStockStatus } from '../utils/stock';
import * as api from '../services/api';

describe('InventoryPage Component & Logic', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'fetchProducts').mockResolvedValue([]);
  });
  it('correctly derives stock status based on stock and minStock thresholds', () => {
    expect(getStockStatus(0, 5)).toBe('Out of Stock');
    expect(getStockStatus(-1, 5)).toBe('Out of Stock');
    expect(getStockStatus(3, 5)).toBe('Low Stock');
    expect(getStockStatus(5, 5)).toBe('Low Stock');
    expect(getStockStatus(6, 5)).toBe('In Stock');
    expect(getStockStatus(50, 10)).toBe('In Stock');
  });

  it('renders products table and filters items by search query', () => {
    render(<InventoryPage />);

    expect(screen.getByText(/Wireless Barcode Scanner/i)).toBeInTheDocument();
    expect(screen.getByText(/Thermal Receipt Printer/i)).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/search by sku/i);
    fireEvent.change(searchInput, { target: { value: 'Thermal' } });

    expect(screen.getByText(/Thermal Receipt Printer/i)).toBeInTheDocument();
    expect(screen.queryByText(/Wireless Barcode Scanner/i)).not.toBeInTheDocument();
  });

  it('displays empty state when no product matches search', () => {
    render(<InventoryPage />);

    const searchInput = screen.getByPlaceholderText(/search by sku/i);
    fireEvent.change(searchInput, { target: { value: 'NonExistentProduct12345' } });

    expect(screen.getByText(/No matching products found/i)).toBeInTheDocument();
  });
});
