import {
  Match,
  CreateMatchRequest,
  UpdateMatchRequest,
  GroupStanding,
  UpcomingVenueMatch,
} from '@shared/tournament-ops';

export interface MatchUseCase {
  createMatch(req: CreateMatchRequest): Promise<Match>;
  getMatch(matchId: string): Promise<Match | null>;
  listMatches(): Promise<Match[]>;
  updateMatch(matchId: string, req: UpdateMatchRequest): Promise<Match>;
  deleteMatch(matchId: string): Promise<boolean>;
  getUpcomingMatchForVenue(venueId: string): Promise<UpcomingVenueMatch | null>;
}

export interface StandingsUseCase {
  getStandings(groupId: string): Promise<GroupStanding[]>;
  computeStandings(): Promise<Record<string, GroupStanding[]>>;
}
