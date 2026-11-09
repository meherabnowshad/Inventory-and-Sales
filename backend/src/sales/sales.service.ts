import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async getSales() {
    try {
      const invoices = await this.prisma.salesInvoice.findMany({
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

      return {
        success: true,
        data: formatted,
        message: 'Sales invoices fetched successfully from database',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Database error';
      return {
        success: false,
        data: [],
        error: message,
      };
    }
  }
}
