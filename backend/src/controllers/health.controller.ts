import { Request, Response } from 'express';
import { checkDatabaseConnection } from '../config/prisma.js';
import { env } from '../config/env.js';

export async function getHealthStatus(_req: Request, res: Response): Promise<void> {
  const dbStatus = await checkDatabaseConnection();

  res.status(200).json({
    status: 'UP',
    service: 'Inventory and Sales Backend API',
    version: '1.0.0',
    environment: env.NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
}
