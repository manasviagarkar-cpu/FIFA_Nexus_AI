import { Match } from '@shared/tournament-ops';

export interface MatchRepository {
  save(match: Match): Promise<void>;
  findById(matchId: string): Promise<Match | null>;
  findAll(): Promise<Match[]>;
  update(matchId: string, match: Partial<Match>): Promise<void>;
  delete(matchId: string): Promise<boolean>;
  findUpcomingByVenue(venueId: string): Promise<Match[]>;
}

export interface CachePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}
