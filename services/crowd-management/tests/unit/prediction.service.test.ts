import { PredictionService } from '../../src/domain/services/prediction.service';
import { PredictionRepository, ZoneRepository, SensorRepository, AlertRepository, CachePort } from '../../src/domain/ports/outbound.ports';
import { SensorReading, CongestionPrediction, StaffAlert } from '@shared/crowd';

describe('PredictionService Unit Tests', () => {
  let predictionService: PredictionService;
  let mockPredictionRepo: jest.Mocked<PredictionRepository>;
  let mockZoneRepo: jest.Mocked<ZoneRepository>;
  let mockSensorRepo: jest.Mocked<SensorRepository>;
  let mockAlertRepo: jest.Mocked<AlertRepository>;
  let mockCache: jest.Mocked<CachePort>;

  beforeEach(() => {
    mockPredictionRepo = {
      savePrediction: jest.fn().mockResolvedValue(undefined),
      getLatestPredictions: jest.fn().mockResolvedValue([]),
      getLatestPredictionForZone: jest.fn().mockResolvedValue(null),
    };

    mockZoneRepo = {
      getZoneCapacityAndOccupancy: jest.fn(),
      getAllZones: jest.fn().mockResolvedValue([
        {
          id: 'gate-a',
          name: 'Gate A',
          zoneType: 'entrance',
          capacity: 1000,
          currentOccupancy: 800,
          latitude: 40.8,
          longitude: -74.0,
          level: 0,
        },
      ]),
      updateZoneOccupancy: jest.fn().mockResolvedValue(undefined),
    };

    mockSensorRepo = {
      saveReadings: jest.fn(),
      getRecentReadings: jest.fn().mockResolvedValue([]),
    };

    mockAlertRepo = {
      saveAlert: jest.fn().mockResolvedValue(undefined),
      getActiveAlerts: jest.fn().mockResolvedValue([]),
      getAlertById: jest.fn(),
      updateAlertStatus: jest.fn(),
    };

    mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn().mockResolvedValue(undefined),
    };

    predictionService = new PredictionService(
      mockPredictionRepo,
      mockZoneRepo,
      mockSensorRepo,
      mockAlertRepo,
      mockCache
    );
  });

  it('should run prediction cycle successfully and generate prediction objects', async () => {
    const results = await predictionService.runPredictionCycle();
    
    expect(results).toHaveLength(1);
    expect(results[0].zoneId).toBe('gate-a');
    expect(results[0].currentLevel).toBe('high'); // 800 occupancy / 1000 capacity
    expect(mockPredictionRepo.savePrediction).toHaveBeenCalled();
    expect(mockCache.publish).toHaveBeenCalledWith('predictions:cycle', expect.any(String));
  });

  it('should trigger alert if predicted level is critical', async () => {
    // Override zone setup to be highly crowded (critical)
    mockZoneRepo.getAllZones.mockResolvedValueOnce([
      {
        id: 'gate-a',
        name: 'Gate A',
        zoneType: 'entrance',
        capacity: 1000,
        currentOccupancy: 950, // 0.95 density -> Critical
        latitude: 40.8,
        longitude: -74.0,
        level: 0,
      },
    ]);

    const results = await predictionService.runPredictionCycle();
    expect(results[0].currentLevel).toBe('critical');
    expect(mockAlertRepo.saveAlert).toHaveBeenCalled();
    expect(mockCache.publish).toHaveBeenCalledWith('alerts:active', expect.any(String));
  });
});
