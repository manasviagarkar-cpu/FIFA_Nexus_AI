import { Pool } from 'pg';
import { SensorReading, CongestionPrediction, StaffAlert } from '@shared/crowd';
import {
  SensorRepository,
  PredictionRepository,
  AlertRepository,
  ZoneRepository,
} from '../../../domain/ports/outbound.ports';
import { pool } from '../../../infrastructure/database';
import { logger } from '../../../infrastructure/logger';

export class PostgresAdapter
  implements SensorRepository, PredictionRepository, AlertRepository, ZoneRepository
{
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  // ============================================================================
  // SensorRepository
  // ============================================================================
  async saveReadings(readings: SensorReading[], batchId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const query = `
        INSERT INTO sensor_readings (sensor_id, sensor_type, zone_id, payload, recorded_at, batch_id)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      for (const r of readings) {
        await client.query(query, [
          r.sensorId,
          r.sensorType,
          r.zoneId,
          JSON.stringify(r.payload),
          new Date(r.timestamp),
          batchId,
        ]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Failed to save sensor readings batch:', err);
      throw err;
    } finally {
      client.release();
    }
  }

  async getRecentReadings(zoneId: string, limit: number): Promise<SensorReading[]> {
    const query = `
      SELECT sensor_id, sensor_type, zone_id, payload, recorded_at
      FROM sensor_readings
      WHERE zone_id = $1
      ORDER BY recorded_at DESC
      LIMIT $2
    `;
    const res = await this.pool.query(query, [zoneId, limit]);
    return res.rows.map((row) => ({
      sensorId: row.sensor_id,
      sensorType: row.sensor_type,
      zoneId: row.zone_id,
      timestamp: row.recorded_at.toISOString(),
      payload: row.payload,
    }));
  }

  // ============================================================================
  // PredictionRepository
  // ============================================================================
  async savePrediction(p: CongestionPrediction): Promise<void> {
    const query = `
      INSERT INTO congestion_predictions 
      (zone_id, current_level, predicted_15min, predicted_30min, current_occupancy, predicted_occupancy_15min, predicted_occupancy_30min, confidence, trend_direction, trend_rate)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;
    await this.pool.query(query, [
      p.zoneId,
      p.currentLevel,
      p.predicted15Min,
      p.predicted30Min,
      p.currentOccupancy,
      p.predictedOccupancy15Min,
      p.predictedOccupancy30Min,
      p.confidence,
      p.trend.direction,
      p.trend.ratePerMinute,
    ]);
  }

  async getLatestPredictions(): Promise<CongestionPrediction[]> {
    const query = `
      SELECT DISTINCT ON (cp.zone_id) 
        cp.zone_id, cp.current_level, cp.predicted_15min, cp.predicted_30min, cp.current_occupancy, 
        cp.predicted_occupancy_15min, cp.predicted_occupancy_30min, cp.confidence, cp.trend_direction, cp.trend_rate, cp.predicted_at,
        z.name as zone_name, z.zone_type, z.latitude, z.longitude, z.level
      FROM congestion_predictions cp
      JOIN stadium_zones z ON cp.zone_id = z.id
      ORDER BY cp.zone_id, cp.predicted_at DESC
    `;
    const res = await this.pool.query(query);
    return res.rows.map((row) => this.rowToPrediction(row));
  }

  async getLatestPredictionForZone(zoneId: string): Promise<CongestionPrediction | null> {
    const query = `
      SELECT cp.zone_id, cp.current_level, cp.predicted_15min, cp.predicted_30min, cp.current_occupancy, 
             cp.predicted_occupancy_15min, cp.predicted_occupancy_30min, cp.confidence, cp.trend_direction, cp.trend_rate, cp.predicted_at,
             z.name as zone_name, z.zone_type, z.latitude, z.longitude, z.level
      FROM congestion_predictions cp
      JOIN stadium_zones z ON cp.zone_id = z.id
      WHERE cp.zone_id = $1
      ORDER BY cp.predicted_at DESC
      LIMIT 1
    `;
    const res = await this.pool.query(query, [zoneId]);
    if (res.rows.length === 0) return null;
    return this.rowToPrediction(res.rows[0]);
  }

  // ============================================================================
  // AlertRepository
  // ============================================================================
  async saveAlert(a: StaffAlert): Promise<void> {
    const query = `
      INSERT INTO staff_alerts (id, priority, status, category, zone_id, title, description, recommended_action, staff_required)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;
    await this.pool.query(query, [
      a.alertId,
      a.priority,
      a.status,
      a.category,
      a.zoneId,
      a.title,
      a.description,
      a.recommendedAction,
      a.staffRequired,
    ]);
  }

  async getActiveAlerts(): Promise<StaffAlert[]> {
    const query = `
      SELECT sa.id, sa.priority, sa.status, sa.category, sa.zone_id, sa.title, sa.description, sa.recommended_action, sa.staff_required, sa.created_at,
             z.name as zone_name, z.latitude, z.longitude, z.level
      FROM staff_alerts sa
      JOIN stadium_zones z ON sa.zone_id = z.id
      WHERE sa.status = 'active'
      ORDER BY sa.created_at DESC
    `;
    const res = await this.pool.query(query);
    return res.rows.map((row) => this.rowToAlert(row));
  }

  async getAlertById(alertId: string): Promise<StaffAlert | null> {
    const query = `
      SELECT sa.id, sa.priority, sa.status, sa.category, sa.zone_id, sa.title, sa.description, sa.recommended_action, sa.staff_required, sa.created_at,
             sa.acknowledged_by, sa.acknowledged_at, sa.resolved_at,
             z.name as zone_name, z.latitude, z.longitude, z.level
      FROM staff_alerts sa
      JOIN stadium_zones z ON sa.zone_id = z.id
      WHERE sa.id = $1
    `;
    const res = await this.pool.query(query, [alertId]);
    if (res.rows.length === 0) return null;
    return this.rowToAlert(res.rows[0]);
  }

  async updateAlertStatus(
    alertId: string,
    status: string,
    staffId?: string,
    acknowledgedAt?: Date
  ): Promise<void> {
    const query = `
      UPDATE staff_alerts
      SET status = $1, acknowledged_by = $2, acknowledged_at = $3
      WHERE id = $4
    `;
    await this.pool.query(query, [status, staffId || null, acknowledgedAt || null, alertId]);
  }

  // ============================================================================
  // ZoneRepository
  // ============================================================================
  async getZoneCapacityAndOccupancy(
    zoneId: string
  ): Promise<{ capacity: number; currentOccupancy: number } | null> {
    const query = `SELECT capacity, current_occupancy FROM stadium_zones WHERE id = $1`;
    const res = await this.pool.query(query, [zoneId]);
    if (res.rows.length === 0) return null;
    return {
      capacity: res.rows[0].capacity,
      currentOccupancy: res.rows[0].current_occupancy,
    };
  }

  async getAllZones() {
    const query = `SELECT id, name, zone_type, capacity, current_occupancy, latitude, longitude, level FROM stadium_zones`;
    const res = await this.pool.query(query);
    return res.rows.map((row) => ({
      id: row.id,
      name: row.name,
      zoneType: row.zone_type,
      capacity: row.capacity,
      currentOccupancy: row.current_occupancy,
      latitude: row.latitude,
      longitude: row.longitude,
      level: row.level,
    }));
  }

  async updateZoneOccupancy(zoneId: string, occupancy: number): Promise<void> {
    const query = `UPDATE stadium_zones SET current_occupancy = $1 WHERE id = $2`;
    await this.pool.query(query, [occupancy, zoneId]);
  }

  // ============================================================================
  // Mapping Helpers
  // ============================================================================
  private rowToPrediction(row: any): CongestionPrediction {
    return {
      zoneId: row.zone_id,
      zoneName: row.zone_name,
      zoneType: row.zone_type,
      currentOccupancy: row.current_occupancy,
      maxCapacity: row.capacity,
      currentLevel: row.current_level,
      predicted15Min: row.predicted_15min,
      predicted30Min: row.predicted_30min,
      predictedOccupancy15Min: row.predicted_occupancy_15min,
      predictedOccupancy30Min: row.predicted_occupancy_30min,
      confidence: row.confidence,
      trend: {
        direction: row.trend_direction,
        ratePerMinute: parseFloat(row.trend_rate),
      },
      coordinate: {
        latitude: row.latitude,
        longitude: row.longitude,
        level: row.level,
      },
      altText: `Prediction for ${row.zone_name}: Current ${row.current_level}. 15m forecast: ${row.predicted_15min}.`,
      predictedAt: row.predicted_at.toISOString(),
    };
  }

  private rowToAlert(row: any): StaffAlert {
    return {
      alertId: row.id,
      priority: row.priority,
      status: row.status,
      category: row.category,
      zoneId: row.zone_id,
      zoneName: row.zone_name,
      title: row.title,
      description: row.description,
      recommendedAction: row.recommended_action,
      staffRequired: row.staff_required,
      coordinate: {
        latitude: row.latitude,
        longitude: row.longitude,
        level: row.level,
      },
      createdAt: row.created_at.toISOString(),
      acknowledgedBy: row.acknowledged_by,
      acknowledgedAt: row.acknowledged_at ? row.acknowledged_at.toISOString() : undefined,
      altText: `Staff Alert: ${row.title}. Priority ${row.priority}.`,
    };
  }
}
