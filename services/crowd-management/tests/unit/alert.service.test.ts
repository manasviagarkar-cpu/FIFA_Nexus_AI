import { AlertService } from '../../src/domain/services/alert.service';
import { AlertRepository, CachePort } from '../../src/domain/ports/outbound.ports';
import { StaffAlert } from '@shared/crowd';

describe('AlertService Unit Tests', () => {
  let alertService: AlertService;
  let mockAlertRepo: jest.Mocked<AlertRepository>;
  let mockCache: jest.Mocked<CachePort>;

  const sampleAlert: StaffAlert = {
    alertId: 'alert-111',
    priority: 'high' as any,
    status: 'active' as any,
    category: 'congestion',
    zoneId: 'gate-a',
    zoneName: 'Gate A',
    title: 'Congestion Gate A',
    description: 'Crowd build up',
    recommendedAction: 'Deploy staff',
    staffRequired: 2,
    coordinate: { latitude: 40.8, longitude: -74.0, level: 0 },
    createdAt: new Date().toISOString(),
    altText: 'Congestion Gate A',
  };

  beforeEach(() => {
    mockAlertRepo = {
      saveAlert: jest.fn().mockResolvedValue(undefined),
      getActiveAlerts: jest.fn().mockResolvedValue([sampleAlert]),
      getAlertById: jest.fn().mockResolvedValue(sampleAlert),
      updateAlertStatus: jest.fn().mockResolvedValue(undefined),
    };

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      publish: jest.fn().mockResolvedValue(undefined),
    };

    alertService = new AlertService(mockAlertRepo, mockCache);
  });

  it('should retrieve active alerts successfully', async () => {
    const alerts = await alertService.getActiveAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].alertId).toBe('alert-111');
  });

  it('should acknowledge active alert and publish transition update', async () => {
    const staffId = 'staff-abc-123';
    const result = await alertService.acknowledgeAlert('alert-111', staffId, 'Deploying now');
    
    expect(result.status).toBe('acknowledged');
    expect(result.acknowledgedBy).toBe(staffId);
    expect(mockAlertRepo.updateAlertStatus).toHaveBeenCalledWith('alert-111', 'acknowledged', staffId, expect.any(Date));
    expect(mockCache.publish).toHaveBeenCalledWith('alerts:updates', expect.any(String));
  });

  it('should error out when acknowledging an alert that is not active', async () => {
    mockAlertRepo.getAlertById.mockResolvedValueOnce({
      ...sampleAlert,
      status: 'acknowledged' as any,
    });

    await expect(alertService.acknowledgeAlert('alert-111', 'staff-123')).rejects.toThrow('Alert is already in status');
  });
});
