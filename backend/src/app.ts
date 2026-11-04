import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { apiRouter } from './routes/index.js';

export function createApp(): Application {
  const app = express();

  // Security headers (NFR-SEC-03)
  app.use(helmet());

  // CORS configuration
  app.use(
    cors({
      origin: env.CORS_ORIGIN.includes(',') ? env.CORS_ORIGIN.split(',') : env.CORS_ORIGIN,
      credentials: true,
    }),
  );

  // Request parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Logging
  app.use(requestLogger);

  // Root welcome check
  app.get('/', (_req, res) => {
    res.json({
      name: 'Inventory and Sales Management System API',
      status: 'operational',
      healthCheck: '/api/health',
      docs: '/api',
    });
  });

  // Mount API router
  app.use('/api', apiRouter);

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler (NFR-MNT-01)
  app.use(errorHandler);

  return app;
}
