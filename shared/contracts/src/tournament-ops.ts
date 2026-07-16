// ============================================================================
// FIFA Nexus AI — Shared Contracts: Tournament Operations Types
// ============================================================================

import { ZoneType, GeoCoordinate } from './common';

/** Match status lifecycle */
export enum MatchStatus {
  SCHEDULED = 'scheduled',
  LIVE = 'live',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/** Tournament stage */
export enum TournamentStage {
  GROUP = 'group',
  ROUND_OF_32 = 'round_of_32',
  ROUND_OF_16 = 'round_of_16',
  QUARTER_FINAL = 'quarter_final',
  SEMI_FINAL = 'semi_final',
  THIRD_PLACE = 'third_place',
  FINAL = 'final',
}

/** Match/Fixture entity */
export interface Match {
  /** Unique match identifier */
  matchId: string;
  /** Tournament group (e.g., 'A', 'B', ...) — null for knockout rounds */
  groupId: string | null;
  /** Tournament stage */
  stage: TournamentStage;
  /** Home team name (ISO 3-letter country code) */
  homeTeam: string;
  /** Away team name (ISO 3-letter country code) */
  awayTeam: string;
  /** Venue/stadium zone identifier */
  venueId: string;
  /** Venue display name */
  venueName: string;
  /** Scheduled kickoff time (ISO 8601) */
  kickoffTime: string;
  /** Current match status */
  status: MatchStatus;
  /** Home team score (null if not started) */
  homeScore: number | null;
  /** Away team score (null if not started) */
  awayScore: number | null;
  /** Match minute (null if not live) */
  minute: number | null;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/** Request to create a new match */
export interface CreateMatchRequest {
  groupId: string | null;
  stage: TournamentStage;
  homeTeam: string;
  awayTeam: string;
  venueId: string;
  venueName: string;
  kickoffTime: string;
}

/** Request to update match score/status */
export interface UpdateMatchRequest {
  status?: MatchStatus;
  homeScore?: number;
  awayScore?: number;
  minute?: number;
}

/** Group standing entry (computed from match results) */
export interface GroupStanding {
  /** Group identifier (e.g., 'A') */
  groupId: string;
  /** Team identifier (ISO 3-letter country code) */
  team: string;
  /** Matches played */
  played: number;
  /** Matches won */
  won: number;
  /** Matches drawn */
  drawn: number;
  /** Matches lost */
  lost: number;
  /** Goals scored */
  goalsFor: number;
  /** Goals conceded */
  goalsAgainst: number;
  /** Goal difference (goalsFor - goalsAgainst) */
  goalDifference: number;
  /** Points (W=3, D=1, L=0) */
  points: number;
  /** Position in group */
  position: number;
}

/** Upcoming match at a venue (for crowd-management integration) */
export interface UpcomingVenueMatch {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  status: MatchStatus;
  /** Minutes until kickoff (negative if already started) */
  minutesUntilKickoff: number;
}
