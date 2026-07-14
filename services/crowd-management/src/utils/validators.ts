import { z } from 'zod';
import { SensorType } from '@shared/common';

export const coordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  level: z.number().int().default(0),
});

export const turnstilePayloadSchema = z.object({
  type: z.literal('turnstile'),
  entriesCount: z.number().nonnegative().int(),
  exitsCount: z.number().nonnegative().int(),
  periodSeconds: z.number().positive(),
  gateId: z.string().trim().min(1),
});

export const wifiProbePayloadSchema = z.object({
  type: z.literal('wifi_probe'),
  uniqueDevices: z.number().nonnegative().int(),
  connectedDevices: z.number().nonnegative().int(),
  avgSignalStrength: z.number(),
  accessPointId: z.string().trim().min(1),
});

export const cameraPayloadSchema = z.object({
  type: z.literal('camera'),
  personCount: z.number().nonnegative().int(),
  confidence: z.number().min(0).max(1),
  cameraId: z.string().trim().min(1),
  coverageAreaSqm: z.number().positive(),
});

export const environmentalPayloadSchema = z.object({
  type: z.literal('environmental'),
  temperatureCelsius: z.number(),
  humidityPercent: z.number().min(0).max(100),
  co2Ppm: z.number().nonnegative(),
  noiseDb: z.number().nonnegative(),
});

export const crowdCounterPayloadSchema = z.object({
  type: z.literal('crowd_counter'),
  currentCount: z.number().nonnegative().int(),
  inflowRate: z.number().nonnegative(),
  outflowRate: z.number().nonnegative(),
});

export const sensorReadingSchema = z.object({
  sensorId: z.string().trim().min(1),
  sensorType: z.nativeEnum(SensorType),
  zoneId: z.string().trim().min(1),
  timestamp: z.string().datetime(),
  payload: z.discriminatedUnion('type', [
    turnstilePayloadSchema,
    wifiProbePayloadSchema,
    cameraPayloadSchema,
    environmentalPayloadSchema,
    crowdCounterPayloadSchema,
  ]),
});

export const sensorIngestionRequestSchema = z.object({
  readings: z.array(sensorReadingSchema).min(1),
  sourceSystem: z.string().trim().min(1),
  batchId: z.string().trim().min(1),
});

export const alertAcknowledgeSchema = z.object({
  alertId: z.string().uuid(),
  staffId: z.string().uuid(),
  notes: z.string().optional(),
});
