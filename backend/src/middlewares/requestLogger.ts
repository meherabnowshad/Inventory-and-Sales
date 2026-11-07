import morgan from 'morgan';
import { RequestHandler } from 'express';
import { env } from '../config/env.js';

export const requestLogger: RequestHandler = morgan(
  env.NODE_ENV === 'production' ? 'combined' : 'dev',
);
