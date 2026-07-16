import { StandingsService } from '../../src/domain/services/standings.service';
import { MatchRepository, CachePort } from '../../src/domain/ports/outbound.ports';
import { MatchStatus, TournamentStage } from '@shared/tournament-ops';

describe('StandingsService Unit Tests', () => {
  let standingsService: StandingsService;
  let mockMatchRepo: jest.Mocked<MatchRepository>;
  let mockCache: jest.Mocked<CachePort>;

  beforeEach(() => {
    mockMatchRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      delete: jest.fn(),
      findUpcomingByVenue: jest.fn(),
    };

    mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    standingsService = new StandingsService(mockMatchRepo, mockCache);
  });

  it('should retrieve standings from cache if available', async () => {
    const cachedStandings = { A: [{ team: 'USA', points: 3 }] as any };
    mockCache.get.mockResolvedValue(cachedStandings);

    const result = await standingsService.getStandings('A');
    expect(result).toEqual(cachedStandings.A);
    expect(mockMatchRepo.findAll).not.toHaveBeenCalled();
  });

  it('should compute standings correctly from match results', async () => {
    const mockMatches = [
      {
        matchId: '1',
        groupId: 'A',
        stage: TournamentStage.GROUP,
        homeTeam: 'USA',
        awayTeam: 'MEX',
        venueId: 'gate-a',
        venueName: 'MetLife Stadium',
        kickoffTime: new Date().toISOString(),
        status: MatchStatus.COMPLETED,
        homeScore: 2,
        awayScore: 0,
        minute: 90,
      } as any,
      {
        matchId: '2',
        groupId: 'A',
        stage: TournamentStage.GROUP,
        homeTeam: 'CAN',
        awayTeam: 'MEX',
        venueId: 'gate-b',
        venueName: 'MetLife Stadium',
        kickoffTime: new Date().toISOString(),
        status: MatchStatus.COMPLETED,
        homeScore: 1,
        awayScore: 1,
        minute: 90,
      } as any,
    ];
    mockMatchRepo.findAll.mockResolvedValue(mockMatches);

    const result = await standingsService.getStandings('A');
    expect(result).toHaveLength(3);

    // USA should be first: 1 played, 1 won, 3 points, GD +2
    expect(result[0].team).toBe('USA');
    expect(result[0].points).toBe(3);
    expect(result[0].goalDifference).toBe(2);
    expect(result[0].position).toBe(1);

    // CAN should be second: 1 played, 0 won, 1 drawn, 1 point, GD 0
    expect(result[1].team).toBe('CAN');
    expect(result[1].points).toBe(1);
    expect(result[1].goalDifference).toBe(0);
    expect(result[1].position).toBe(2);

    // MEX should be third: 2 played, 0 won, 1 drawn, 1 lost, 1 point, GD -2
    expect(result[2].team).toBe('MEX');
    expect(result[2].points).toBe(1);
    expect(result[2].goalDifference).toBe(-2);
    expect(result[2].position).toBe(3);
  });
});
