import { CongestionLevel } from '@shared/common';

export interface HistoricalPoint {
  occupancy: number;
  timestamp: Date;
}

/**
 * Predicts future congestion levels using Exponentially Weighted Moving Average (EWMA)
 * and simple linear trend prediction.
 */
export class EWMAConfig {
  static getCongestionLevel(occupancy: number, capacity: number): CongestionLevel {
    const ratio = occupancy / Math.max(1, capacity);
    if (ratio < 0.4) return CongestionLevel.LOW;
    if (ratio < 0.65) return CongestionLevel.MODERATE;
    if (ratio < 0.85) return CongestionLevel.HIGH;
    return CongestionLevel.CRITICAL;
  }

  static predictFuture(
    currentOccupancy: number,
    history: HistoricalPoint[],
    alpha: number = 0.3,
    minutesAhead: number = 15
  ): { predictedOccupancy: number; trendRate: number; trendDirection: 'increasing' | 'decreasing' | 'stable' } {
    if (history.length === 0) {
      return { predictedOccupancy: currentOccupancy, trendRate: 0, trendDirection: 'stable' };
    }

    // Sort history by time ascending
    const sorted = [...history].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Calculate EWMA
    let ewma = sorted[0].occupancy;
    for (let i = 1; i < sorted.length; i++) {
      ewma = alpha * sorted[i].occupancy + (1 - alpha) * ewma;
    }

    // Now factor in the current reading
    ewma = alpha * currentOccupancy + (1 - alpha) * ewma;

    // Linear delta calculation over the last 15-30 mins
    const firstPoint = sorted[0];
    const timeDeltaMs = new Date().getTime() - firstPoint.timestamp.getTime();
    const timeDeltaMins = timeDeltaMs / 60000;

    let trendRate = 0;
    if (timeDeltaMins > 1) {
      const occupancyDelta = currentOccupancy - firstPoint.occupancy;
      trendRate = occupancyDelta / timeDeltaMins; // occupancy change per minute
    }

    const predictedOccupancy = Math.max(0, Math.round(currentOccupancy + trendRate * minutesAhead));
    const trendDirection = trendRate > 0.5 ? 'increasing' : trendRate < -0.5 ? 'decreasing' : 'stable';

    return {
      predictedOccupancy,
      trendRate,
      trendDirection,
    };
  }
}
