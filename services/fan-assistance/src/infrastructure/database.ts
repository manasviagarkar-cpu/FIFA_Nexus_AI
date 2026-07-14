import { Pool } from 'pg';
import { config } from '../config';
import { logger } from './logger';

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error('Database connection pool unexpected error:', err);
});

export const connectDb = async (): Promise<void> => {
  try {
    const client = await pool.connect();
    logger.info('Connected to PostgreSQL database pool.');
    client.release();
  } catch (err) {
    logger.error('Failed to establish database connection:', err);
    throw err;
  }
};
