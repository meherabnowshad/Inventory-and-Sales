export function getStockStatus(
  stock: number,
  minStock: number,
): 'In Stock' | 'Low Stock' | 'Out of Stock' {
  if (stock <= 0) return 'Out of Stock';
  if (stock <= minStock) return 'Low Stock';
  return 'In Stock';
}
