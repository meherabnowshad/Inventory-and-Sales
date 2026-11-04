import { Router, Request, Response } from 'express';

export const inventoryRouter = Router();

// Skeleton endpoint for inventory summary
inventoryRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      { id: 'prod-001', sku: 'SKU-1001', name: 'Standard Widget A', price: 29.99, stock: 45 },
      { id: 'prod-002', sku: 'SKU-1002', name: 'Premium Gadget B', price: 99.5, stock: 12 },
      { id: 'prod-003', sku: 'SKU-1003', name: 'Deluxe Tool C', price: 149.0, stock: 3 },
    ],
    message: 'Inventory API skeleton initialized successfully',
  });
});
