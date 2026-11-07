import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';

export const salesRouter = Router();

// Endpoint to fetch sales invoices from PostgreSQL database
salesRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const invoices = await prisma.salesInvoice.findMany({
      include: {
        lines: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = invoices.map((inv) => ({
      id: inv.id.toString(),
      saleNumber: inv.invoiceNumber || `INV-${inv.id}`,
      itemsCount: inv.lines.reduce((sum, line) => sum + line.quantity, 0),
      totalAmount: inv.total.toString(),
      taxAmount: '0.00',
      date: new Date(inv.createdAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      status: inv.status,
    }));

    res.json({
      success: true,
      data: formatted,
      message: 'Sales invoices fetched successfully from database',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Database error';
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});
