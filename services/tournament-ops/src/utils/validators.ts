import { z } from 'zod';
import { TournamentStage, MatchStatus } from '@shared/tournament-ops';

export const createMatchSchema = z.object({
  groupId: z.string().trim().min(1).nullable(),
  stage: z.nativeEnum(TournamentStage),
  homeTeam: z.string().trim().length(3).transform((val) => val.toUpperCase()),
  awayTeam: z.string().trim().length(3).transform((val) => val.toUpperCase()),
  venueId: z.string().trim().min(1),
  venueName: z.string().trim().min(1),
  kickoffTime: z.string().datetime(),
});

export const updateMatchSchema = z.object({
  status: z.nativeEnum(MatchStatus).optional(),
  homeScore: z.number().int().nonnegative().optional(),
  awayScore: z.number().int().nonnegative().optional(),
  minute: z.number().int().min(0).max(130).nullable().optional(),
});
