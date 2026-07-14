import { SensorReading, CongestionPrediction, StaffAlert } from '@shared/crowd';
import { ZoneDensityInfo } from '@shared/wayfinding';

export interface SensorRepository {
  saveReadings(readings: SensorReading[], batchId: string): Promise<void>;
  getRecentReadings(zoneId: string, limit: number): Promise<SensorReading[]>;
}

export interface PredictionRepository {
  savePrediction(prediction: CongestionPrediction): Promise<void>;
  getLatestPredictions(): Promise<CongestionPrediction[]>;
  getLatestPredictionForZone(zoneId: string): Promise<CongestionPrediction | null>;
}

export interface AlertRepository {
  saveAlert(alert: StaffAlert): Promise<void>;
  getActiveAlerts(): Promise<StaffAlert[]>;
  getAlertById(alertId: string): Promise<StaffAlert | null>;
  updateAlertStatus(alertId: string, status: string, staffId?: string, acknowledgedAt?: Date): Promise<void>;
}

export interface ZoneRepository {
  getZoneCapacityAndOccupancy(zoneId: string): Promise<{ capacity: number; currentOccupancy: number } | null>;
  getAllZones(): Promise<{ id: string; name: string; zoneType: string; capacity: number; currentOccupancy: number; latitude: number; longitude: number; level: number }[]>;
  updateZoneOccupancy(zoneId: string, occupancy: number): Promise<void>;
}

export interface CachePort {
  get<T>(key: str): Promise<T | null>;
  set<T>(key: str, value: T, ttlSeconds: number): Promise<void>;
  publish(channel: string, message: string): Promise<void>;
}
