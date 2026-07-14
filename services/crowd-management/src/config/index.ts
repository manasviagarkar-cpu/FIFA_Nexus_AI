import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export const config = {
  service: {
    name: process.env.SERVICE_NAME || 'crowd-management',
    version: '1.0.0',
    port: parseInt(process.env.SERVICE_PORT || '8002', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  db: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'fifa_nexus',
    user: process.env.POSTGRES_USER || 'nexus_admin',
    password: process.env.POSTGRES_PASSWORD || 'nexus_secure_2026',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || 'nexus_redis_2026',
    db: 0,
    cacheTtl: 300,
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'fifa-nexus-jwt-secret-2026-change-in-production',
  },
  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:8080').split(','),
  },
  prediction: {
    intervalMs: 30000, // Predict every 30 seconds
    alpha: 0.3, // EWMA smoothing factor
  },
};
