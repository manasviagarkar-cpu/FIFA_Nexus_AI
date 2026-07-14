import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../../../config';
import { JWTPayload, UserRole, ROLE_PERMISSIONS } from '@shared/auth';
import { logger } from '../../../../infrastructure/logger';

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Access token is missing from the authorization headers.',
        statusCode: 401,
        timestamp: new Date().toISOString(),
      },
    });
  }

  jwt.verify(token, config.auth.jwtSecret, (err, decoded) => {
    if (err) {
      logger.warn('Failed token verification attempt:', err.message);
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access token is invalid or has expired.',
          statusCode: 403,
          timestamp: new Date().toISOString(),
        },
      });
    }

    req.user = decoded as JWTPayload;
    next();
  });
};

export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated', statusCode: 401 } });
    }

    const role = req.user.role as UserRole;
    const permissions = ROLE_PERMISSIONS[role] || [];

    if (!permissions.includes(permission)) {
      logger.warn(`User ${req.user.sub} (role: ${role}) denied permission: ${permission}`);
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient privileges to perform this operation.',
          statusCode: 403,
          timestamp: new Date().toISOString(),
        },
      });
    }

    next();
  };
};
