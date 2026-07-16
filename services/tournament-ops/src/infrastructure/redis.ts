import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from './logger';

export let redisClient: RedisClientType;

export const connectRedis = async (): Promise<void> => {
  const url = process.env.REDIS_URL || `redis://${config.redis.host}:${config.redis.port}`;
  redisClient = createClient(
    process.env.REDIS_URL
      ? { url }
      : {
          url,
          password: config.redis.password,
        }
  ) as RedisClientType;

  redisClient.on('error', (err) => {
    logger.error('Redis client error:', err);
  });

  redisClient.on('connect', () => {
    logger.info('Connected to Redis server.');
  });

  await redisClient.connect();
};
