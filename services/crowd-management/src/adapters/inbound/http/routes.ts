import { Router } from 'express';
import { SensorController } from './controllers/sensor.controller';
import { PredictionController } from './controllers/prediction.controller';
import { SensorIngestionService } from '../../../domain/services/sensor-ingestion.service';
import { PredictionService } from '../../../domain/services/prediction.service';
import { AlertService } from '../../../domain/services/alert.service';
import { PostgresAdapter } from '../../outbound/database/postgres.adapter';
import { RedisAdapter } from '../../outbound/cache/redis.adapter';
import { authenticateToken, requirePermission } from './middleware/auth.middleware';
import { rateLimiter } from './middleware/rate-limit.middleware';
import { validateBody } from './middleware/validation.middleware';
import { sensorIngestionRequestSchema, alertAcknowledgeSchema } from '../../../utils/validators';

export const createRouter = (): Router => {
  const router = Router();

  // Instantiate adapters
  const dbAdapter = new PostgresAdapter();
  const cacheAdapter = new RedisAdapter();

  // Instantiate services
  const ingestionService = new SensorIngestionService(dbAdapter, dbAdapter, cacheAdapter);
  const alertService = new AlertService(dbAdapter, cacheAdapter);
  const predictionService = new PredictionService(dbAdapter, dbAdapter, dbAdapter, dbAdapter, cacheAdapter);

  // Instantiate controllers
  const sensorController = new SensorController(ingestionService);
  const predictionController = new PredictionController(predictionService, alertService);

  // Routes
  router.post(
    '/sensors/ingest',
    authenticateToken,
    rateLimiter,
    requirePermission('sensor:ingest'),
    validateBody(sensorIngestionRequestSchema),
    sensorController.ingest
  );

  router.get(
    '/predictions/current',
    authenticateToken,
    rateLimiter,
    requirePermission('prediction:view'),
    predictionController.getCurrentPredictions
  );

  router.get(
    '/predictions/zone/:zoneId',
    authenticateToken,
    rateLimiter,
    requirePermission('prediction:view'),
    predictionController.getZonePrediction
  );

  router.post(
    '/predictions/trigger',
    authenticateToken,
    rateLimiter,
    requirePermission('prediction:configure'),
    predictionController.triggerCycle
  );

  router.get(
    '/alerts/active',
    authenticateToken,
    rateLimiter,
    requirePermission('alert:view'),
    predictionController.getActiveAlerts
  );

  router.post(
    '/alerts/acknowledge',
    authenticateToken,
    rateLimiter,
    requirePermission('alert:acknowledge'),
    validateBody(alertAcknowledgeSchema),
    predictionController.acknowledgeAlert
  );

  return router;
};
