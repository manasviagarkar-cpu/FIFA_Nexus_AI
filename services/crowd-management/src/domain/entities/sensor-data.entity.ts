import { SensorReading } from '@shared/crowd';

export interface SensorDataEntity extends SensorReading {
  id?: string;
  processedAt?: string;
}
