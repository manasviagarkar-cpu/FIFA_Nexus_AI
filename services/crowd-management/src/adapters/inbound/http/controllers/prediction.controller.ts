import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { CrowdPredictionUseCase, AlertUseCase } from '../../../../domain/ports/inbound.ports';
import { logger } from '../../../../infrastructure/logger';

export class PredictionController {
  constructor(
    private predictionService: CrowdPredictionUseCase,
    private alertService: AlertUseCase
  ) {}

  getCurrentPredictions = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const predictions = await this.predictionService.getLatestPredictions();
      return res.status(200).json({
        success: true,
        data: predictions,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          traceId: crypto.randomUUID(),
          altText: 'Active stadium zones congestion predictions list.',
        },
      });
    } catch (err: any) {
      logger.error('Failed to get predictions:', err);
      return res.status(500).json({
        success: false,
        error: {
          code: 'PREDICTIONS_FAILED',
          message: 'An error occurred while fetching congestion predictions.',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        },
      });
    }
  };

  getZonePrediction = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { zoneId } = req.params;
      const prediction = await this.predictionService.getPredictionForZone(zoneId);
      if (!prediction) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `No predictions found for zone ${zoneId}`,
            statusCode: 404,
          },
        });
      }
      return res.status(200).json({
        success: true,
        data: prediction,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          traceId: crypto.randomUUID(),
          altText: prediction.altText,
        },
      });
    } catch (err: any) {
      logger.error('Failed to get zone prediction:', err);
      return res.status(500).json({
        success: false,
        error: {
          code: 'PREDICTIONS_FAILED',
          message: 'An error occurred while fetching zone congestion prediction.',
          statusCode: 500,
        },
      });
    }
  };

  triggerCycle = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const predictions = await this.predictionService.runPredictionCycle();
      return res.status(200).json({
        success: true,
        data: predictions,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          traceId: crypto.randomUUID(),
          altText: 'Crowd management prediction cycle manually triggered and resolved.',
        },
      });
    } catch (err: any) {
      logger.error('Failed to trigger prediction cycle:', err);
      return res.status(500).json({
        success: false,
        error: {
          code: 'PREDICTION_CYCLE_FAILED',
          message: 'Failed to run prediction analysis cycle.',
          details: err.message,
          statusCode: 500,
        },
      });
    }
  };

  getActiveAlerts = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const alerts = await this.alertService.getActiveAlerts();
      return res.status(200).json({
        success: true,
        data: alerts,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          traceId: crypto.randomUUID(),
          altText: 'List of active staff dispatch operations alerts.',
        },
      });
    } catch (err: any) {
      logger.error('Failed to retrieve active alerts:', err);
      return res.status(500).json({
        success: false,
        error: {
          code: 'ALERTS_RETRIEVAL_FAILED',
          message: 'Failed to fetch active alerts list.',
          statusCode: 500,
        },
      });
    }
  };

  acknowledgeAlert = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { alertId, staffId, notes } = req.body;
      const updated = await this.alertService.acknowledgeAlert(alertId, staffId, notes);
      return res.status(200).json({
        success: true,
        data: updated,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          traceId: crypto.randomUUID(),
          altText: `Alert ${alertId} acknowledged successfully.`,
        },
      });
    } catch (err: any) {
      logger.error('Failed to acknowledge alert:', err);
      return res.status(400).json({
        success: false,
        error: {
          code: 'ACKNOWLEDGE_FAILED',
          message: err.message,
          statusCode: 400,
        },
      });
    }
  };
}
