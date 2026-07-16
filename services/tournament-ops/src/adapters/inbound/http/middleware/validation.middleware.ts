import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Validation failed.',
          details: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
          statusCode: 400,
          timestamp: new Date().toISOString(),
        },
      });
    }
    req.body = result.data;
    next();
  };
};
