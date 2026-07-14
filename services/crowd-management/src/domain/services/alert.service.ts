import { StaffAlert } from '@shared/crowd';
import { AlertUseCase } from '../ports/inbound.ports';
import { AlertRepository, CachePort } from '../ports/outbound.ports';
import { logger } from '../../infrastructure/logger';

export class AlertService implements AlertUseCase {
  constructor(
    private alertRepo: AlertRepository,
    private cache: CachePort
  ) {}

  async getActiveAlerts(): Promise<StaffAlert[]> {
    return this.alertRepo.getActiveAlerts();
  }

  async acknowledgeAlert(alertId: string, staffId: string, notes?: string): Promise<StaffAlert> {
    logger.info(`Acknowledging alert ${alertId} by staff ${staffId}`);
    const alert = await this.alertRepo.getAlertById(alertId);
    
    if (!alert) {
      throw new Error(`Alert with ID ${alertId} not found.`);
    }

    if (alert.status !== 'active') {
      throw new Error(`Alert is already in status '${alert.status}'.`);
    }

    const acknowledgedAt = new Date();
    await this.alertRepo.updateAlertStatus(alertId, 'acknowledged', staffId, acknowledgedAt);

    const updatedAlert: StaffAlert = {
      ...alert,
      status: 'acknowledged' as any,
      acknowledgedBy: staffId,
      acknowledgedAt: acknowledgedAt.toISOString(),
    };

    // Publish update
    await this.cache.publish('alerts:updates', JSON.stringify(updatedAlert));
    return updatedAlert;
  }

  async triggerAlert(alertData: Omit<StaffAlert, 'alertId' | 'status' | 'createdAt' | 'altText'>): Promise<StaffAlert> {
    const newAlert: StaffAlert = {
      ...alertData,
      alertId: crypto.randomUUID(),
      status: 'active' as any,
      createdAt: new Date().toISOString(),
      altText: `Alert: ${alertData.title} in zone ${alertData.zoneName}. Priority: ${alertData.priority}.`,
    };

    await this.alertRepo.saveAlert(newAlert);
    await this.cache.publish('alerts:active', JSON.stringify(newAlert));
    logger.info(`Manual alert triggered: ${newAlert.title} in ${newAlert.zoneName}`);
    return newAlert;
  }
}
