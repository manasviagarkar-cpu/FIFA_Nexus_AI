import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { redisClient } from '../../../../infrastructure/redis';
import { DEFAULT_RATE_LIMITS, UserRole } from '@shared/auth';
import { logger } from '../../../../infrastructure/logger';

export const rateLimiter = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next();
  }

  const role = req.user.role as UserRole;
  const config = DEFAULT_RATE_LIMITS[role] || DEFAULT_RATE_LIMITS[UserRole.FAN];
  const maxRequests = config.maxRequests;
  const windowSeconds = config.windowSeconds;

  const key = `rate_limit:crowd:${req.user.sub}`;
  const now = Date.now();
  const clearBefore = now - windowSeconds * 1000;

  try {
    const multi = redisClient.multi();
    multi.zRemRangeByScore(key, 0, clearBefore);
    multi.zAdd(key, { score: now, value: now.toString() });
    multi.zCard(key);
    multi.expire(key, windowSeconds + 5);

    const results = await multi.exec();
    const requestCount = results[2] as number;

    const remaining = Math.max(0, maxRequests - requestCount);
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);

    if (requestCount > maxRequests) {
      res.setHeader('Retry-After', windowSeconds);
      return res.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Rate limit exceeded. Please slow down requests.',
          statusCode: 429,
          timestamp: new Date().toISOString(),
        },
      });
    }

    next();
  } catch (err) {
    logger.error('Redis rate limit execution failure:', err);
    // Fail open
    next();
  }
};
