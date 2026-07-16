import { CongestionPrediction, StaffAlert } from '@shared/crowd';
import { CongestionLevel, AlertPriority } from '@shared/common';
import { CrowdPredictionUseCase } from '../ports/inbound.ports';
import {
  PredictionRepository,
  ZoneRepository,
  SensorRepository,
  CachePort,
  AlertRepository,
  MatchSchedulePort,
} from '../ports/outbound.ports';
import { EWMAConfig, HistoricalPoint } from '../../utils/prediction-model';
import { logger } from '../../infrastructure/logger';

export class PredictionService implements CrowdPredictionUseCase {
  constructor(
    private predictionRepo: PredictionRepository,
    private zoneRepo: ZoneRepository,
    private sensorRepo: SensorRepository,
    private alertRepo: AlertRepository,
    private cache: CachePort,
    private matchSchedule?: MatchSchedulePort
  ) {}

  async getLatestPredictions(): Promise<CongestionPrediction[]> {
    const cached = await this.cache.get<CongestionPrediction[]>('crowd:predictions:latest');
    if (cached) return cached;

    const predictions = await this.predictionRepo.getLatestPredictions();
    await this.cache.set('crowd:predictions:latest', predictions, 30);
    return predictions;
  }

  async getPredictionForZone(zoneId: string): Promise<CongestionPrediction | null> {
    return this.predictionRepo.getLatestPredictionForZone(zoneId);
  }

  async runPredictionCycle(): Promise<CongestionPrediction[]> {
    logger.info('Starting crowd management congestion prediction cycle...');
    const zones = await this.zoneRepo.getAllZones();
    const predictions: CongestionPrediction[] = [];

    for (const zone of zones) {
      // Get last 30 minutes of sensor readings for this zone
      const recentReadings = await this.sensorRepo.getRecentReadings(zone.id, 10);

      const history: HistoricalPoint[] = recentReadings.map((r) => {
        let occ = 0;
        if (r.sensorType === 'turnstile') {
          occ = (r.payload as any).entriesCount || 0;
        } else if (r.sensorType === 'camera') {
          occ = (r.payload as any).personCount || 0;
        } else if (r.sensorType === 'crowd_counter') {
          occ = (r.payload as any).currentCount || 0;
        }
        return {
          occupancy: occ,
          timestamp: new Date(r.timestamp),
        };
      });

      // Calculate predictions using EWMA model
      const currentOccupancy = zone.currentOccupancy;
      const capacity = zone.capacity;

      const prediction15 = EWMAConfig.predictFuture(currentOccupancy, history, 0.3, 15);
      const prediction30 = EWMAConfig.predictFuture(currentOccupancy, history, 0.3, 30);

      let pred15Occupancy = prediction15.predictedOccupancy;
      let pred30Occupancy = prediction30.predictedOccupancy;

      // Tournament-ops integration: boost predictions near match kickoff
      if (this.matchSchedule) {
        try {
          const upcoming = await this.matchSchedule.getUpcomingMatchForVenue(zone.id);
          if (upcoming && upcoming.minutesUntilKickoff <= 60 && upcoming.minutesUntilKickoff > 0) {
            // Apply kickoff surge factor: up to 40% boost scaling inversely with time to kickoff
            const surgeFactor = 1 + 0.4 * (1 - upcoming.minutesUntilKickoff / 60);
            pred15Occupancy = Math.round(pred15Occupancy * surgeFactor);
            pred30Occupancy = Math.round(pred30Occupancy * surgeFactor);
            logger.info(
              `Kickoff surge applied for zone ${zone.id}: match in ${upcoming.minutesUntilKickoff}min, factor ${surgeFactor.toFixed(2)}`
            );
          }
        } catch (err) {
          logger.warn(`Failed to query match schedule for zone ${zone.id}:`, err);
        }
      }

      const currentLevel = EWMAConfig.getCongestionLevel(currentOccupancy, capacity);
      const level15 = EWMAConfig.getCongestionLevel(pred15Occupancy, capacity);
      const level30 = EWMAConfig.getCongestionLevel(pred30Occupancy, capacity);

      const prediction: CongestionPrediction = {
        zoneId: zone.id,
        zoneName: zone.name,
        zoneType: zone.zoneType as any,
        currentOccupancy,
        maxCapacity: capacity,
        currentLevel,
        predicted15Min: level15,
        predicted30Min: level30,
        predictedOccupancy15Min: pred15Occupancy,
        predictedOccupancy30Min: pred30Occupancy,
        confidence: history.length > 3 ? 0.9 : 0.6,
        trend: {
          direction: prediction15.trendDirection,
          ratePerMinute: Math.round(prediction15.trendRate * 100) / 100,
        },
        coordinate: {
          latitude: zone.latitude,
          longitude: zone.longitude,
          level: zone.level,
        },
        altText: `Prediction for ${zone.name}: Current ${currentLevel}. 15m forecast: ${level15} (${pred15Occupancy} people).`,
        predictedAt: new Date().toISOString(),
      };

      await this.predictionRepo.savePrediction(prediction);
      predictions.push(prediction);

      // Check if predictions breach critical thresholds and trigger alerts
      if (level15 === CongestionLevel.CRITICAL || level30 === CongestionLevel.CRITICAL) {
        await this.checkAndTriggerCongestionAlert(prediction);
      }
    }

    // Cache the predictions
    await this.cache.set('crowd:predictions:latest', predictions, 30);

    // Publish updates to websocket clients
    await this.cache.publish('predictions:cycle', JSON.stringify(predictions));

    logger.info(`Crowd prediction cycle finished. Predicted ${predictions.length} zones.`);
    return predictions;
  }

  private async checkAndTriggerCongestionAlert(prediction: CongestionPrediction): Promise<void> {
    const activeAlerts = await this.alertRepo.getActiveAlerts();
    const existing = activeAlerts.find(
      (a) => a.zoneId === prediction.zoneId && a.category === 'congestion'
    );

    if (existing) {
      // Alert already active, don't spam duplicate alerts
      return;
    }

    // Trigger new automated alert
    const newAlert: StaffAlert = {
      alertId: crypto.randomUUID(),
      priority: AlertPriority.HIGH,
      status: 'active' as any,
      category: 'congestion',
      zoneId: prediction.zoneId,
      zoneName: prediction.zoneName,
      title: `Critical Congestion Warning: ${prediction.zoneName}`,
      description: `Predictive analytics indicates critical crowding in ${prediction.zoneName} within the next 15-30 minutes. Current occupancy: ${prediction.currentOccupancy}/${prediction.maxCapacity}.`,
      recommendedAction:
        'Deploy 4 additional guest-relations staff to manage queuing, open secondary egress gates, and trigger wayfinding reroutes.',
      staffRequired: 4,
      coordinate: prediction.coordinate,
      createdAt: new Date().toISOString(),
      altText: `High priority congestion alert in ${prediction.zoneName}. Staff deployment required.`,
    };

    await this.alertRepo.saveAlert(newAlert);
    await this.cache.publish('alerts:active', JSON.stringify(newAlert));
    logger.warn(
      `Automated staff deployment alert triggered for zone ${prediction.zoneId} due to predicted congestion.`
    );
  }
}

