import { SensorIngestionService } from '../../src/domain/services/sensor-ingestion.service';
import { SensorRepository, ZoneRepository, CachePort } from '../../src/domain/ports/outbound.ports';
import { SensorReading, SensorType } from '@shared/crowd';

describe('SensorIngestionService Unit Tests', () => {
  let ingestionService: SensorIngestionService;
  let mockSensorRepo: jest.Mocked<SensorRepository>;
  let mockZoneRepo: jest.Mocked<ZoneRepository>;
  let mockCache: jest.Mocked<CachePort>;

  beforeEach(() => {
    mockSensorRepo = {
      saveReadings: jest.fn().mockResolvedValue(undefined),
      getRecentReadings: jest.fn(),
    };

    mockZoneRepo = {
      getZoneCapacityAndOccupancy: jest.fn().mockResolvedValue({ capacity: 1000, currentOccupancy: 200 }),
      getAllZones: jest.fn(),
      updateZoneOccupancy: jest.fn().mockResolvedValue(undefined),
    };

    mockCache = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn().mockResolvedValue(undefined),
    };

    ingestionService = new SensorIngestionService(mockSensorRepo, mockZoneRepo, mockCache);
  });

  it('should process turnstile readings and increment occupancy correctly', async () => {
    const reading: SensorReading = {
      sensorId: 'turn-01',
      sensorType: 'turnstile' as any,
      zoneId: 'gate-a',
      timestamp: new Date().toISOString(),
      payload: {
        type: 'turnstile',
        entriesCount: 50,
        exitsCount: 10,
        periodSeconds: 60,
        gateId: 'gate-a1',
      },
    };

    const result = await ingestionService.ingest([reading], 'turnstile-system', 'batch-111');
    expect(result.processedCount).toBe(1);
    expect(mockSensorRepo.saveReadings).toHaveBeenCalled();
    // Delta was net +40 (50 - 10). Initial occupancy 200. Updated should be 240.
    expect(mockZoneRepo.updateZoneOccupancy).toHaveBeenCalledWith('gate-a', 240);
    // Invalidate caches
    expect(mockCache.set).toHaveBeenCalledWith('stadium:map', null, 0);
    expect(mockCache.set).toHaveBeenCalledWith('zone:densities', null, 0);
  });

  it('should process camera readings and replace occupancy absolutely', async () => {
    const reading: SensorReading = {
      sensorId: 'cam-01',
      sensorType: 'camera' as any,
      zoneId: 'gate-a',
      timestamp: new Date().toISOString(),
      payload: {
        type: 'camera',
        personCount: 150,
        confidence: 0.95,
        cameraId: 'cam-gate-a',
        coverageAreaSqm: 100,
      },
    };

    const result = await ingestionService.ingest([reading], 'cctv-system', 'batch-222');
    expect(result.processedCount).toBe(1);
    // Camera is absolute override, so occupancy becomes 150.
    expect(mockZoneRepo.updateZoneOccupancy).toHaveBeenCalledWith('gate-a', 150);
  });
});
