import { SensorType, CongestionLevel, AlertPriority, AlertStatus, GeoCoordinate, ZoneType } from './common';
/** Raw sensor data reading from IoT devices */
export interface SensorReading {
    /** Unique sensor identifier */
    sensorId: string;
    /** Type of sensor */
    sensorType: SensorType;
    /** Zone where the sensor is located */
    zoneId: string;
    /** Reading timestamp (ISO 8601) */
    timestamp: string;
    /** Sensor-specific data payload */
    payload: TurnstilePayload | WifiProbePayload | CameraPayload | EnvironmentalPayload | CrowdCounterPayload;
}
/** Turnstile sensor data */
export interface TurnstilePayload {
    type: 'turnstile';
    /** Number of entries in the reading period */
    entriesCount: number;
    /** Number of exits in the reading period */
    exitsCount: number;
    /** Reading period duration in seconds */
    periodSeconds: number;
    /** Gate identifier */
    gateId: string;
}
/** Wi-Fi probe sensor data */
export interface WifiProbePayload {
    type: 'wifi_probe';
    /** Number of unique devices detected */
    uniqueDevices: number;
    /** Number of connected devices */
    connectedDevices: number;
    /** Average signal strength (dBm) */
    avgSignalStrength: number;
    /** Access point identifier */
    accessPointId: string;
}
/** Camera-based crowd counting data */
export interface CameraPayload {
    type: 'camera';
    /** Estimated person count in frame */
    personCount: number;
    /** Detection confidence (0.0 - 1.0) */
    confidence: number;
    /** Camera identifier */
    cameraId: string;
    /** Frame coverage area in square meters */
    coverageAreaSqm: number;
}
/** Environmental sensor data */
export interface EnvironmentalPayload {
    type: 'environmental';
    /** Temperature in Celsius */
    temperatureCelsius: number;
    /** Humidity percentage */
    humidityPercent: number;
    /** CO2 level in ppm */
    co2Ppm: number;
    /** Noise level in decibels */
    noiseDb: number;
}
/** Crowd counter sensor data */
export interface CrowdCounterPayload {
    type: 'crowd_counter';
    /** Current count of people in zone */
    currentCount: number;
    /** Inflow rate (people per minute) */
    inflowRate: number;
    /** Outflow rate (people per minute) */
    outflowRate: number;
}
/** Batch sensor data ingestion request */
export interface SensorIngestionRequest {
    /** Array of sensor readings */
    readings: SensorReading[];
    /** Source system identifier */
    sourceSystem: string;
    /** Batch identifier for deduplication */
    batchId: string;
}
/** Sensor ingestion response */
export interface SensorIngestionResponse {
    /** Number of readings processed */
    processedCount: number;
    /** Number of readings rejected (validation failures) */
    rejectedCount: number;
    /** Batch identifier */
    batchId: string;
    /** Processing timestamp */
    processedAt: string;
    /** Rejected reading details */
    rejections?: {
        sensorId: string;
        reason: string;
    }[];
}
/** Congestion prediction for a zone */
export interface CongestionPrediction {
    /** Zone identifier */
    zoneId: string;
    /** Zone name */
    zoneName: string;
    /** Zone type */
    zoneType: ZoneType;
    /** Current occupancy */
    currentOccupancy: number;
    /** Maximum capacity */
    maxCapacity: number;
    /** Current congestion level */
    currentLevel: CongestionLevel;
    /** Predicted congestion level in 15 minutes */
    predicted15Min: CongestionLevel;
    /** Predicted congestion level in 30 minutes */
    predicted30Min: CongestionLevel;
    /** Predicted occupancy in 15 minutes */
    predictedOccupancy15Min: number;
    /** Predicted occupancy in 30 minutes */
    predictedOccupancy30Min: number;
    /** Confidence in prediction (0.0 - 1.0) */
    confidence: number;
    /** Trend direction and magnitude */
    trend: {
        direction: 'increasing' | 'decreasing' | 'stable';
        ratePerMinute: number;
    };
    /** Location coordinate */
    coordinate: GeoCoordinate;
    /** Alt-text description for accessibility */
    altText: string;
    /** Prediction timestamp */
    predictedAt: string;
}
/** Staff deployment alert */
export interface StaffAlert {
    /** Unique alert identifier */
    alertId: string;
    /** Alert priority */
    priority: AlertPriority;
    /** Current status */
    status: AlertStatus;
    /** Alert type/category */
    category: 'congestion' | 'incident' | 'maintenance' | 'medical' | 'security';
    /** Target zone */
    zoneId: string;
    /** Zone name */
    zoneName: string;
    /** Human-readable alert title */
    title: string;
    /** Detailed description */
    description: string;
    /** Recommended action */
    recommendedAction: string;
    /** Number of staff to deploy */
    staffRequired: number;
    /** Location coordinate */
    coordinate: GeoCoordinate;
    /** Alert creation timestamp */
    createdAt: string;
    /** Acknowledgement timestamp */
    acknowledgedAt?: string;
    /** Acknowledged by (user ID) */
    acknowledgedBy?: string;
    /** Resolution timestamp */
    resolvedAt?: string;
    /** Alt-text for accessibility */
    altText: string;
}
/** Alert acknowledgement request */
export interface AlertAcknowledgeRequest {
    alertId: string;
    staffId: string;
    notes?: string;
}
//# sourceMappingURL=crowd.d.ts.map