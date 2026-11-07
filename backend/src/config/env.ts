import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface AppConfig {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  CORS_ORIGIN: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  LOG_LEVEL: string;
}

export const env: AppConfig = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5001', 10),
  DATABASE_URL:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/inventory_sales_db?schema=public',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  JWT_SECRET: process.env.JWT_SECRET || 'dev_insecure_jwt_secret_key_1234567890',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
  LOG_LEVEL: process.env.LOG_LEVEL || 'dev',
};
