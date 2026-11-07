import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';

export const inventoryRouter = Router();

// Endpoint to fetch real products from PostgreSQL database
inventoryRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        category: {
          select: { name: true },
        },
      },
      orderBy: { id: 'asc' },
    });

    const formatted = products.map((p) => ({
      id: p.id.toString(),
      sku: p.sku,
      name: p.name,
      category: p.category.name,
      purchasePrice: p.purchasePrice.toString(),
      price: p.sellingPrice.toString(),
      stock: p.stockQty,
      minStock: p.minStock,
      isActive: p.isActive,
    }));

    res.json({
      success: true,
      data: formatted,
      message: 'Products fetched successfully from database',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Database error';
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});
