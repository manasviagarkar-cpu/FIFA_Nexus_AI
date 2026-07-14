import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { typeDefs } from './adapters/inbound/graphql/schema';
import { createTranslationResolver } from './adapters/inbound/graphql/resolvers/translation.resolver';
import { createStadiumResolver } from './adapters/inbound/graphql/resolvers/stadium.resolver';
import { TranslationService } from './domain/services/translation.service';
import { StadiumQueryService } from './domain/services/stadium-query.service';
import { FeedbackService } from './domain/services/feedback.service';
import { PostgresAdapter } from './adapters/outbound/database/postgres.adapter';
import { RedisAdapter } from './adapters/outbound/cache/redis.adapter';
import { GeminiAdapter } from './adapters/outbound/gemini/gemini.adapter';
import { connectDb, pool } from './infrastructure/database';
import { connectRedis, redisClient } from './infrastructure/redis';
import { logger } from './infrastructure/logger';
import { JWTPayload, UserRole, DEFAULT_RATE_LIMITS } from '@shared/auth';

const app = express();
const server = http.createServer(app);

// Express middlewares
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
}));
app.use(cors({ origin: config.cors.origins, credentials: true }));
app.use(express.json());

// Express REST Health check endpoint
app.get('/api/v1/health', async (req, res) => {
  const uptime = process.uptime();
  const dependencies: { name: string; status: 'connected' | 'disconnected'; latencyMs?: number }[] = [];
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  try {
    const t0 = Date.now();
    await pool.query('SELECT 1');
    dependencies.push({ name: 'postgres', status: 'connected', latencyMs: Date.now() - t0 });
  } catch (err) {
    overallStatus = 'degraded';
    dependencies.push({ name: 'postgres', status: 'disconnected' });
  }

  try {
    const t0 = Date.now();
    await redisClient.ping();
    dependencies.push({ name: 'redis', status: 'connected', latencyMs: Date.now() - t0 });
  } catch (err) {
    overallStatus = 'degraded';
    dependencies.push({ name: 'redis', status: 'disconnected' });
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

const bootstrap = async () => {
  try {
    await connectDb();
    await connectRedis();

    // Wire up adapters and services
    const dbAdapter = new PostgresAdapter();
    const cacheAdapter = new RedisAdapter();
    const geminiAdapter = new GeminiAdapter();

    const translationService = new TranslationService(dbAdapter, geminiAdapter, cacheAdapter);
    const stadiumQueryService = new StadiumQueryService(geminiAdapter, dbAdapter, cacheAdapter);
    const feedbackService = new FeedbackService(dbAdapter);

    // Build Apollo resolvers
    const translationResolvers = createTranslationResolver(translationService);
    const stadiumResolvers = createStadiumResolver(stadiumQueryService, feedbackService);

    // Merge resolvers
    const resolvers = {
      Query: {
        ...translationResolvers.Query,
        ...stadiumResolvers.Query,
      },
      Mutation: {
        ...stadiumResolvers.Mutation,
      },
    };

    const apolloServer = new ApolloServer({
      typeDefs,
      resolvers,
      introspection: true,
    });

    await apolloServer.start();

    // Express Rate Limiter for GraphQL requests
    const checkRateLimit = async (user: JWTPayload) => {
      const role = user.role as UserRole;
      const limits = DEFAULT_RATE_LIMITS[role] || DEFAULT_RATE_LIMITS[UserRole.FAN];
      const maxRequests = limits.maxRequests;
      const windowSeconds = limits.windowSeconds;

      const key = `rate_limit:fan-assist:${user.sub}`;
      const now = Date.now();
      const clearBefore = now - windowSeconds * 1000;

      const multi = redisClient.multi();
      multi.zRemRangeByScore(key, 0, clearBefore);
      multi.zAdd(key, { score: now, value: now.toString() });
      multi.zCard(key);
      multi.expire(key, windowSeconds + 5);

      const results = await multi.exec();
      const count = results[2] as number;

      if (count > maxRequests) {
        throw new Error('Rate limit exceeded. Please wait a minute.');
      }
    };

    app.use(
      '/graphql',
      expressMiddleware(apolloServer, {
        context: async ({ req, res }) => {
          const authHeader = req.headers.authorization;
          const token = authHeader && authHeader.split(' ')[1];
          let user: JWTPayload | undefined;

          if (token) {
            try {
              user = jwt.verify(token, config.auth.jwtSecret) as JWTPayload;
              // Run sliding window rate limit
              await checkRateLimit(user);
            } catch (err: any) {
              logger.warn('GraphQL Request context setup error:', err.message);
              // We return undefined user context. Resolver will block if needed.
            }
          }

          return { user, res };
        },
      })
    );

    server.listen(config.service.port, () => {
      logger.info(`Fan Assistance GraphQL server active at http://localhost:${config.service.port}/graphql`);
    });
  } catch (err) {
    logger.error('GraphQL Service bootstrap failed:', err);
    process.exit(1);
  }
};

bootstrap();

// Graceful shut down
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down worker...`);
  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      await pool.end();
      logger.info('Postgres pool closed.');
      await redisClient.disconnect();
      logger.info('Redis client disconnected.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown:', err);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
