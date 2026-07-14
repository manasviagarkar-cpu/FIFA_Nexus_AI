import { SensorReading, CongestionPrediction, StaffAlert } from '@shared/crowd';

export interface SensorIngestionUseCase {
  ingest(
    readings: SensorReading[],
    sourceSystem: string,
    batchId: string
  ): Promise<{
    processedCount: number;
    rejectedCount: number;
    batchId: string;
    processedAt: string;
    rejections?: { sensorId: string; reason: string }[];
  }>;
}

export interface CrowdPredictionUseCase {
  getLatestPredictions(): Promise<CongestionPrediction[]>;
  getPredictionForZone(zoneId: string): Promise<CongestionPrediction | null>;
  runPredictionCycle(): Promise<CongestionPrediction[]>;
}

export interface AlertUseCase {
  getActiveAlerts(): Promise<StaffAlert[]>;
  acknowledgeAlert(alertId: string, staffId: string, notes?: string): Promise<StaffAlert>;
  triggerAlert(
    alert: Omit<StaffAlert, 'alertId' | 'status' | 'createdAt' | 'altText'>
  ): Promise<StaffAlert>;
}
