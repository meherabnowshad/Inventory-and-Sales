import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connected to PostgreSQL via Prisma.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`PostgreSQL connection pending/skeleton mode: ${message}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async checkConnection(): Promise<{ connected: boolean; message: string }> {
    try {
      await this.$queryRaw`SELECT 1`;
      return {
        connected: true,
        message: 'PostgreSQL connection verified via Prisma.',
      };
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : 'Unknown database error';
      return {
        connected: false,
        message: `Database connection unavailable (skeleton mode): ${errMessage}`,
      };
    }
  }
}
