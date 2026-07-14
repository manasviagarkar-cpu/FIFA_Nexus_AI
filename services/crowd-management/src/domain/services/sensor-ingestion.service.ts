import { SensorReading } from '@shared/crowd';
import { SensorIngestionUseCase } from '../ports/inbound.ports';
import { SensorRepository, ZoneRepository, CachePort } from '../ports/outbound.ports';
import { logger } from '../../infrastructure/logger';

export class SensorIngestionService implements SensorIngestionUseCase {
  constructor(
    private sensorRepo: SensorRepository,
    private zoneRepo: ZoneRepository,
    private cache: CachePort
  ) {}

  async ingest(readings: SensorReading[], sourceSystem: string, batchId: string) {
    logger.info(`Processing ingestion batch ${batchId} from source ${sourceSystem}. Count: ${readings.length}`);

    // Save to sensor data historical log
    await this.sensorRepo.saveReadings(readings, batchId);

    // Group readings by zone to process occupancy updates
    const zoneUpdates: Record<string, number> = {};

    for (const reading of readings) {
      const zoneId = reading.zoneId;

      // Extract occupancy updates from specific sensors
      if (reading.sensorType === 'turnstile') {
        const payload = reading.payload as any;
        const netChange = (payload.entriesCount || 0) - (payload.exitsCount || 0);
        zoneUpdates[zoneId] = (zoneUpdates[zoneId] || 0) + netChange;
      } else if (reading.sensorType === 'crowd_counter') {
        const payload = reading.payload as any;
        // Absolute count override (always takes preference if available)
        zoneUpdates[zoneId] = payload.currentCount;
      } else if (reading.sensorType === 'camera') {
        const payload = reading.payload as any;
        // Cameras provide a point-in-time density check
        zoneUpdates[zoneId] = payload.personCount;
      }
    }

    // Apply updates to the database
    for (const [zoneId, deltaOrCount] of Object.entries(zoneUpdates)) {
      try {
        const currentData = await this.zoneRepo.getZoneCapacityAndOccupancy(zoneId);
        if (currentData) {
          let newOccupancy = currentData.currentOccupancy;
          
          // If the counter or camera is used, it's an absolute value; if turnstile, it's a delta.
          // Let's look up if we have turnstiles for that zone.
          const zoneReadings = readings.filter(r => r.zoneId === zoneId);
          const hasAbsolute = zoneReadings.some(r => r.sensorType === 'crowd_counter' || r.sensorType === 'camera');
          
          if (hasAbsolute) {
            newOccupancy = deltaOrCount;
          } else {
            newOccupancy = Math.max(0, newOccupancy + deltaOrCount);
          }

          // Bound occupancy to max capacity plus brief spillover
          newOccupancy = Math.min(newOccupancy, currentData.capacity * 1.5);

          await this.zoneRepo.updateZoneOccupancy(zoneId, newOccupancy);
          
          // Publish real-time density update for sub/pub synchronization
          const densityRatio = newOccupancy / Math.max(1, currentData.capacity);
          await this.cache.publish('zone:density:updates', JSON.stringify({
            zoneId,
            currentOccupancy: newOccupancy,
            densityRatio,
          }));
        }
      } catch (err: any) {
        logger.error(`Failed to update occupancy for zone ${zoneId}:`, err);
      }
    }

    // Invalidate cached wayfinding map/densities to force recalculations
    await this.cache.set('stadium:map', null, 0);
    await this.cache.set('zone:densities', null, 0);

    return {
      processedCount: readings.length,
      rejectedCount: 0,
      batchId,
      processedAt: new Date().toISOString(),
    };
  }
}
