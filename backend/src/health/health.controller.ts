import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getHealth(@Res() res: Response) {
    const dbStatus = await this.prisma.checkConnection();

    const statusCode = dbStatus.connected ? 200 : 200; // skeleton mode returns 200 with UP

    return res.status(statusCode).json({
      status: 'UP',
      service: 'Inventory and Sales Backend API (NestJS 10)',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptimeSeconds: Math.floor(process.uptime()),
      database: dbStatus,
      timestamp: new Date().toISOString(),
    });
  }
}
