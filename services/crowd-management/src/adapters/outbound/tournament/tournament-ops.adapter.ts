import { MatchSchedulePort } from '../../../domain/ports/outbound.ports';
import { config } from '../../../config';
import { logger } from '../../../infrastructure/logger';

export class TournamentOpsAdapter implements MatchSchedulePort {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.tournamentOps.url;
  }

  async getUpcomingMatchForVenue(
    venueId: string
  ): Promise<{ kickoffTime: string; minutesUntilKickoff: number } | null> {
    try {
      const url = `${this.baseUrl}/api/v1/matches/venue/${encodeURIComponent(venueId)}/upcoming`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        if (res.status === 404) {
          return null;
        }
        logger.warn(`Tournament Ops service returned error ${res.status} for venue ${venueId}`);
        return null;
      }

      const body = await res.json();
      if (body.success && body.data) {
        return {
          kickoffTime: body.data.kickoffTime,
          minutesUntilKickoff: body.data.minutesUntilKickoff,
        };
      }
      return null;
    } catch (err: any) {
      logger.error(`Failed to connect to Tournament Ops service for venue ${venueId}:`, err.message || err);
      return null;
    }
  }
}
