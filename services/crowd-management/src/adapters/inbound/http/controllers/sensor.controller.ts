import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { SensorIngestionUseCase } from '../../../../domain/ports/inbound.ports';
import { logger } from '../../../../infrastructure/logger';

export class SensorController {
  constructor(private ingestionService: SensorIngestionUseCase) {}

  ingest = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { readings, sourceSystem, batchId } = req.body;
      const result = await this.ingestionService.ingest(readings, sourceSystem, batchId);
      return res.status(200).json({
        success: true,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          traceId: crypto.randomUUID(),
          altText: `Processed sensor batch ${batchId}.`,
        },
      });
    } catch (err: any) {
      logger.error('Failed to ingest sensor readings:', err);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INGEST_FAILED',
          message: 'An error occurred while ingesting the sensor batch.',
          details: err.message,
          statusCode: 500,
          timestamp: new Date().toISOString(),
        },
      });
    }
  };
}
