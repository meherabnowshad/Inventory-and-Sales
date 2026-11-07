import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log('====================================================');
  console.log(`🚀 Inventory & Sales Backend running in [${env.NODE_ENV}] mode`);
  console.log(`📡 Server URL:        http://localhost:${env.PORT}`);
  console.log(`🩺 Health Endpoint:   http://localhost:${env.PORT}/api/health`);
  console.log(`🔗 Allowed Origin:    ${env.CORS_ORIGIN}`);
  console.log('====================================================');
});

// Graceful shutdown
async function handleShutdown(signal: string): Promise<void> {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log('Prisma disconnected.');
    } catch {
      // ignore
    }
    console.log('Backend HTTP server closed.');
    process.exit(0);
  });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
