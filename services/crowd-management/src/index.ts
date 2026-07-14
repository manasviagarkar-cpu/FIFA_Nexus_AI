import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import http from 'http';
import { config } from './config';
import { createRouter } from './adapters/inbound/http/routes';
import { setupWebSocketServer } from './adapters/inbound/websocket/sensor-stream';
import { connectDb, pool } from './infrastructure/database';
import { connectRedis, redisClient } from './infrastructure/redis';
import { logger } from './infrastructure/logger';
import { PostgresAdapter } from './adapters/outbound/database/postgres.adapter';
import { RedisAdapter } from './adapters/outbound/cache/redis.adapter';
import { PredictionService } from './domain/services/prediction.service';

const app = express();
const server = http.createServer(app);

// Express setup
app.use(helmet());
app.use(cors({ origin: config.cors.origins, credentials: true }));
app.use(express.json());

// Latency tracking middleware
app.use((req, res, next) => {
  const start = process.hrtime();
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const timeInMs = (diff[0] * 1e9 + diff[1]) / 1e6;
    logger.debug(`${req.method} ${req.originalUrl} - Latency: ${timeInMs.toFixed(2)}ms`);
  });
  next();
});

// Health check endpoint
app.get('/api/v1/health', async (req, res) => {
  const uptime = process.uptime();
  const dependencies: { name: string; status: 'connected' | 'disconnected'; latencyMs?: number }[] =
    [];
  let overallStatus: string = 'healthy';

  // Test Database
  try {
    const t0 = Date.now();
    await pool.query('SELECT 1');
    const latency = Date.now() - t0;
    dependencies.push({ name: 'postgres', status: 'connected', latencyMs: latency });
  } catch (err: any) {
    overallStatus = 'degraded';
    dependencies.push({ name: 'postgres', status: 'disconnected' });
    logger.error('Health check DB ping failed:', err);
  }

  // Test Redis
  try {
    const t0 = Date.now();
    await redisClient.ping();
    const latency = Date.now() - t0;
    dependencies.push({ name: 'redis', status: 'connected', latencyMs: latency });
  } catch (err: any) {
    overallStatus = 'degraded';
    dependencies.push({ name: 'redis', status: 'disconnected' });
    logger.error('Health check Redis ping failed:', err);
  }

  return res.status(overallStatus === 'unhealthy' ? 500 : 200).json({
    status: overallStatus,
    service: config.service.name,
    version: config.service.version,
    uptime,
    timestamp: new Date().toISOString(),
    dependencies,
  });
});

// Wire routes
app.use('/api/v1', createRouter());

// Express Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled request exception:', err);
  return res.status(err.statusCode || 500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected application exception occurred.',
      statusCode: err.statusCode || 500,
      timestamp: new Date().toISOString(),
    },
  });
});

// Background prediction runner
let predictionTimer: NodeJS.Timeout;
const startPredictionPipeline = (predictionService: PredictionService) => {
  logger.info(`Starting periodic prediction loop every ${config.prediction.intervalMs / 1000}s`);

  const runCycle = async () => {
    try {
      await predictionService.runPredictionCycle();
    } catch (err) {
      logger.error('Prediction cycle run failed:', err);
    }
  };

  // Run immediately then schedule
  runCycle();
  predictionTimer = setInterval(runCycle, config.prediction.intervalMs);
};

// Bootstrap servers
const bootstrap = async () => {
  try {
    await connectDb();
    await connectRedis();

    // Start WebSocket server
    setupWebSocketServer(server);

    // Setup services for background runner
    const dbAdapter = new PostgresAdapter();
    const cacheAdapter = new RedisAdapter();
    const predictionService = new PredictionService(
      dbAdapter,
      dbAdapter,
      dbAdapter,
      dbAdapter,
      cacheAdapter
    );

    startPredictionPipeline(predictionService);

    server.listen(config.service.port, () => {
      logger.info(`Crowd Management Service active on port ${config.service.port}`);
    });
  } catch (err) {
    logger.error('Service bootstrap failed:', err);
    process.exit(1);
  }
};

bootstrap();

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down worker...`);
  clearInterval(predictionTimer);

  server.close(async () => {
    logger.info('HTTP server closed.');

    try {
      await pool.end();
      logger.info('Database pool closed.');
      await redisClient.disconnect();
      logger.info('Redis client disconnected.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during graceful shutdown cleanup:', err);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
