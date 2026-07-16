import { GroupStanding, Match, MatchStatus } from '@shared/tournament-ops';
import { StandingsUseCase } from '../ports/inbound.ports';
import { MatchRepository, CachePort } from '../ports/outbound.ports';
import { logger } from '../../infrastructure/logger';

export class StandingsService implements StandingsUseCase {
  constructor(
    private matchRepo: MatchRepository,
    private cache: CachePort
  ) {}

  async getStandings(groupId: string): Promise<GroupStanding[]> {
    const all = await this.computeStandings();
    return all[groupId.toUpperCase()] || [];
  }

  async computeStandings(): Promise<Record<string, GroupStanding[]>> {
    const cacheKey = 'standings:all';
    const cached = await this.cache.get<Record<string, GroupStanding[]>>(cacheKey);
    if (cached) return cached;

    const matches = await this.matchRepo.findAll();
    const groupMatches = matches.filter((m) => m.groupId !== null);

    const standingsMap: Record<string, Record<string, GroupStanding>> = {};

    // Initialize standings map
    for (const m of groupMatches) {
      const gId = m.groupId!.toUpperCase();
      if (!standingsMap[gId]) {
        standingsMap[gId] = {};
      }
      for (const team of [m.homeTeam, m.awayTeam]) {
        if (!standingsMap[gId][team]) {
          standingsMap[gId][team] = {
            groupId: gId,
            team,
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,
            points: 0,
            position: 0,
          };
        }
      }
    }

    // Process match results
    for (const m of groupMatches) {
      if (
        m.status !== MatchStatus.COMPLETED &&
        m.status !== MatchStatus.LIVE
      ) {
        continue;
      }
      if (m.homeScore === null || m.awayScore === null) {
        continue;
      }

      const gId = m.groupId!.toUpperCase();
      const home = standingsMap[gId][m.homeTeam];
      const away = standingsMap[gId][m.awayTeam];

      home.played += 1;
      away.played += 1;
      home.goalsFor += m.homeScore;
      home.goalsAgainst += m.awayScore;
      away.goalsFor += m.awayScore;
      away.goalsAgainst += m.homeScore;

      if (m.homeScore > m.awayScore) {
        home.won += 1;
        home.points += 3;
        away.lost += 1;
      } else if (m.homeScore < m.awayScore) {
        away.won += 1;
        away.points += 3;
        home.lost += 1;
      } else {
        home.drawn += 1;
        home.points += 1;
        away.drawn += 1;
        away.points += 1;
      }

      home.goalDifference = home.goalsFor - home.goalsAgainst;
      away.goalDifference = away.goalsFor - away.goalsAgainst;
    }

    const finalStandings: Record<string, GroupStanding[]> = {};

    // Sort teams in each group and calculate positions
    for (const [gId, teamsMap] of Object.entries(standingsMap)) {
      const teams = Object.values(teamsMap);

      // Sort according to points, then goal difference, then goals for
      teams.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;

        // Head-to-head tiebreaker (simplified: checks if they played and who won)
        const directMatch = groupMatches.find(
          (m) =>
            m.groupId!.toUpperCase() === gId &&
            ((m.homeTeam === a.team && m.awayTeam === b.team) ||
              (m.homeTeam === b.team && m.awayTeam === a.team)) &&
            m.status === MatchStatus.COMPLETED &&
            m.homeScore !== null &&
            m.awayScore !== null
        );

        if (directMatch) {
          const homeIsA = directMatch.homeTeam === a.team;
          const scoreA = homeIsA ? directMatch.homeScore! : directMatch.awayScore!;
          const scoreB = homeIsA ? directMatch.awayScore! : directMatch.homeScore!;
          if (scoreA !== scoreB) {
            return scoreB - scoreA; // Descending score
          }
        }

        return a.team.localeCompare(b.team); // Alphabetical fallback
      });

      // Assign position
      teams.forEach((t, idx) => {
        t.position = idx + 1;
      });

      finalStandings[gId] = teams;
    }

    await this.cache.set(cacheKey, finalStandings, 30);
    logger.info('Computed group standings successfully.');
    return finalStandings;
  }
}
