import {
  Match,
  CreateMatchRequest,
  UpdateMatchRequest,
  UpcomingVenueMatch,
  MatchStatus,
} from '@shared/tournament-ops';
import { MatchUseCase } from '../ports/inbound.ports';
import { MatchRepository, CachePort } from '../ports/outbound.ports';
import { logger } from '../../infrastructure/logger';

export class MatchService implements MatchUseCase {
  constructor(
    private matchRepo: MatchRepository,
    private cache: CachePort
  ) {}

  async createMatch(req: CreateMatchRequest): Promise<Match> {
    const now = new Date().toISOString();
    const match: Match = {
      matchId: crypto.randomUUID(),
      groupId: req.groupId,
      stage: req.stage,
      homeTeam: req.homeTeam,
      awayTeam: req.awayTeam,
      venueId: req.venueId,
      venueName: req.venueName,
      kickoffTime: req.kickoffTime,
      status: MatchStatus.SCHEDULED,
      homeScore: null,
      awayScore: null,
      minute: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.matchRepo.save(match);
    await this.invalidateCache();
    logger.info(`Match created successfully: ${match.matchId}`);
    return match;
  }

  async getMatch(matchId: string): Promise<Match | null> {
    return this.matchRepo.findById(matchId);
  }

  async listMatches(): Promise<Match[]> {
    const cached = await this.cache.get<Match[]>('matches:all');
    if (cached) return cached;

    const matches = await this.matchRepo.findAll();
    await this.cache.set('matches:all', matches, 30);
    return matches;
  }

  async updateMatch(matchId: string, req: UpdateMatchRequest): Promise<Match> {
    const existing = await this.matchRepo.findById(matchId);
    if (!existing) {
      throw new Error(`Match with ID ${matchId} not found.`);
    }

    const updates: Partial<Match> = {
      updatedAt: new Date().toISOString(),
    };

    if (req.status !== undefined) updates.status = req.status;
    if (req.homeScore !== undefined) updates.homeScore = req.homeScore;
    if (req.awayScore !== undefined) updates.awayScore = req.awayScore;
    if (req.minute !== undefined) updates.minute = req.minute;

    await this.matchRepo.update(matchId, updates);
    await this.invalidateCache();
    logger.info(`Match updated successfully: ${matchId}`);

    return {
      ...existing,
      ...updates,
    } as Match;
  }

  async deleteMatch(matchId: string): Promise<boolean> {
    const deleted = await this.matchRepo.delete(matchId);
    if (deleted) {
      await this.invalidateCache();
      logger.info(`Match deleted: ${matchId}`);
    }
    return deleted;
  }

  async getUpcomingMatchForVenue(venueId: string): Promise<UpcomingVenueMatch | null> {
    const cacheKey = `venue:${venueId}:upcoming`;
    const cached = await this.cache.get<UpcomingVenueMatch>(cacheKey);
    if (cached) return cached;

    const matches = await this.matchRepo.findUpcomingByVenue(venueId);
    if (matches.length === 0) return null;

    // Find the next upcoming match (earliest kickoff time that is scheduled or live)
    const activeMatches = matches
      .filter((m) => m.status === MatchStatus.SCHEDULED || m.status === MatchStatus.LIVE)
      .sort((a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime());

    if (activeMatches.length === 0) return null;

    const nextMatch = activeMatches[0];
    const kickoff = new Date(nextMatch.kickoffTime);
    const now = new Date();
    const minutesUntilKickoff = Math.round((kickoff.getTime() - now.getTime()) / 60000);

    const upcoming: UpcomingVenueMatch = {
      matchId: nextMatch.matchId,
      homeTeam: nextMatch.homeTeam,
      awayTeam: nextMatch.awayTeam,
      kickoffTime: nextMatch.kickoffTime,
      status: nextMatch.status,
      minutesUntilKickoff,
    };

    // Cache it for 10 seconds (short duration since minutesUntilKickoff changes rapidly)
    await this.cache.set(cacheKey, upcoming, 10);
    return upcoming;
  }

  private async invalidateCache(): Promise<void> {
    await this.cache.del('matches:all');
    await this.cache.del('standings:all');
  }
}
