import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';
import type { Response } from 'express';

describe('HealthController (NFR-OPS-01)', () => {
  let controller: HealthController;
  let mockPrismaService: Partial<PrismaService>;
  let mockResponse: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    mockResponse = {
      status: statusMock as unknown as Response['status'],
    };

    mockPrismaService = {
      checkConnection: vi.fn().mockResolvedValue({
        connected: true,
        message: 'PostgreSQL connection verified via Prisma queryRaw.',
      }),
    };

    controller = new HealthController(mockPrismaService as PrismaService);
  });

  it('returns status UP and 200 OK when database is connected', async () => {
    await controller.getHealth(mockResponse as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'UP',
        service: 'Inventory and Sales Backend API (NestJS 10)',
        version: '1.0.0',
        database: expect.objectContaining({ connected: true }),
      }),
    );
  });

  it('returns status UP with skeleton warning when database is disconnected', async () => {
    mockPrismaService.checkConnection = vi.fn().mockResolvedValue({
      connected: false,
      message: 'Database connection unavailable',
    });

    await controller.getHealth(mockResponse as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'UP',
        database: expect.objectContaining({ connected: false }),
      }),
    );
  });
});
