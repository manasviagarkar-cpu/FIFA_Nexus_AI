import { SensorReading, CongestionPrediction, StaffAlert } from '@shared/crowd';

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
  updateAlertStatus(
    alertId: string,
    status: string,
    staffId?: string,
    acknowledgedAt?: Date
  ): Promise<void>;
}

export interface ZoneRepository {
  getZoneCapacityAndOccupancy(
    zoneId: string
  ): Promise<{ capacity: number; currentOccupancy: number } | null>;
  getAllZones(): Promise<
    {
      id: string;
      name: string;
      zoneType: string;
      capacity: number;
      currentOccupancy: number;
      latitude: number;
      longitude: number;
      level: number;
    }[]
  >;
  updateZoneOccupancy(zoneId: string, occupancy: number): Promise<void>;
}

export interface CachePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  publish(channel: string, message: string): Promise<void>;
}

/** Cross-service port for tournament-ops match schedule queries */
export interface MatchSchedulePort {
  getUpcomingMatchForVenue(
    venueId: string
  ): Promise<{ kickoffTime: string; minutesUntilKickoff: number } | null>;
}
