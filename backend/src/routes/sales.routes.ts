import { Router, Request, Response } from 'express';

export const salesRouter = Router();

// Skeleton endpoint for sales summary
salesRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      { id: 'sale-001', saleNumber: 'INV-2026-001', totalAmount: 129.49, status: 'COMPLETED' },
      { id: 'sale-002', saleNumber: 'INV-2026-002', totalAmount: 59.98, status: 'COMPLETED' },
    ],
    message: 'Sales API skeleton initialized successfully',
  });
});
