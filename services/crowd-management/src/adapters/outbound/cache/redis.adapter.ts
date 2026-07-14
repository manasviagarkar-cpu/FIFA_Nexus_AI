import { CachePort } from '../../../domain/ports/outbound.ports';
import { redisClient } from '../../../infrastructure/redis';
import { logger } from '../../../infrastructure/logger';

export class RedisAdapter implements CachePort {
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redisClient.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (err) {
      logger.error(`Redis get error for key ${key}:`, err);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await redisClient.set(key, serialized, { EX: ttlSeconds });
      } else {
        await redisClient.set(key, serialized);
      }
    } catch (err) {
      logger.error(`Redis set error for key ${key}:`, err);
    }
  }

  async publish(channel: string, message: string): Promise<void> {
    try {
      await redisClient.publish(channel, message);
    } catch (err) {
      logger.error(`Redis publish error on channel ${channel}:`, err);
    }
  }
}
