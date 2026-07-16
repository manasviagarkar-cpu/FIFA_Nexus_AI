import { MatchService } from '../../src/domain/services/match.service';
import { MatchRepository, CachePort } from '../../src/domain/ports/outbound.ports';
import { MatchStatus, TournamentStage, CreateMatchRequest, UpdateMatchRequest } from '@shared/tournament-ops';

describe('MatchService Unit Tests', () => {
  let matchService: MatchService;
  let mockMatchRepo: jest.Mocked<MatchRepository>;
  let mockCache: jest.Mocked<CachePort>;

  beforeEach(() => {
    mockMatchRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
      findAll: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(true),
      findUpcomingByVenue: jest.fn().mockResolvedValue([]),
    };

    mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    matchService = new MatchService(mockMatchRepo, mockCache);
  });

  it('should create a match correctly', async () => {
    const req: CreateMatchRequest = {
      groupId: 'A',
      stage: TournamentStage.GROUP,
      homeTeam: 'USA',
      awayTeam: 'MEX',
      venueId: 'gate-a',
      venueName: 'MetLife Stadium',
      kickoffTime: new Date(Date.now() + 3600000).toISOString(),
    };

    const result = await matchService.createMatch(req);
    expect(result.matchId).toBeDefined();
    expect(result.status).toBe(MatchStatus.SCHEDULED);
    expect(result.homeTeam).toBe('USA');
    expect(mockMatchRepo.save).toHaveBeenCalled();
    expect(mockCache.del).toHaveBeenCalledWith('matches:all');
  });

  it('should find a match by id', async () => {
    const mockMatch = {
      matchId: '123',
      groupId: 'A',
      stage: TournamentStage.GROUP,
      homeTeam: 'USA',
      awayTeam: 'MEX',
      venueId: 'gate-a',
      venueName: 'MetLife Stadium',
      kickoffTime: new Date().toISOString(),
      status: MatchStatus.SCHEDULED,
      homeScore: null,
      awayScore: null,
      minute: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockMatchRepo.findById.mockResolvedValue(mockMatch);

    const result = await matchService.getMatch('123');
    expect(result).toEqual(mockMatch);
  });

  it('should list matches, retrieving from cache if available', async () => {
    const cachedMatches = [{ matchId: 'cached' } as any];
    mockCache.get.mockResolvedValue(cachedMatches);

    const result = await matchService.listMatches();
    expect(result).toEqual(cachedMatches);
    expect(mockMatchRepo.findAll).not.toHaveBeenCalled();
  });

  it('should list matches, calling repository if not in cache', async () => {
    const repoMatches = [{ matchId: 'repo' } as any];
    mockMatchRepo.findAll.mockResolvedValue(repoMatches);

    const result = await matchService.listMatches();
    expect(result).toEqual(repoMatches);
    expect(mockCache.get).toHaveBeenCalledWith('matches:all');
    expect(mockCache.set).toHaveBeenCalledWith('matches:all', repoMatches, 30);
  });

  it('should update a match correctly', async () => {
    const mockMatch = {
      matchId: '123',
      groupId: 'A',
      stage: TournamentStage.GROUP,
      homeTeam: 'USA',
      awayTeam: 'MEX',
      venueId: 'gate-a',
      venueName: 'MetLife Stadium',
      kickoffTime: new Date().toISOString(),
      status: MatchStatus.SCHEDULED,
      homeScore: null,
      awayScore: null,
      minute: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockMatchRepo.findById.mockResolvedValue(mockMatch);

    const updates: UpdateMatchRequest = {
      status: MatchStatus.LIVE,
      homeScore: 2,
      awayScore: 1,
      minute: 45,
    };

    const result = await matchService.updateMatch('123', updates);
    expect(result.status).toBe(MatchStatus.LIVE);
    expect(result.homeScore).toBe(2);
    expect(result.awayScore).toBe(1);
    expect(result.minute).toBe(45);
    expect(mockMatchRepo.update).toHaveBeenCalled();
  });

  it('should throw error when updating non-existent match', async () => {
    mockMatchRepo.findById.mockResolvedValue(null);
    await expect(matchService.updateMatch('123', {})).rejects.toThrow();
  });

  it('should delete a match correctly', async () => {
    const result = await matchService.deleteMatch('123');
    expect(result).toBe(true);
    expect(mockMatchRepo.delete).toHaveBeenCalledWith('123');
    expect(mockCache.del).toHaveBeenCalled();
  });

  it('should query upcoming match for venue dynamically', async () => {
    const now = new Date();
    const futureKickoff = new Date(now.getTime() + 1800000).toISOString(); // 30 minutes in future
    const matches = [
      {
        matchId: 'm1',
        homeTeam: 'CAN',
        awayTeam: 'USA',
        kickoffTime: futureKickoff,
        status: MatchStatus.SCHEDULED,
      } as any,
    ];
    mockMatchRepo.findUpcomingByVenue.mockResolvedValue(matches);

    const result = await matchService.getUpcomingMatchForVenue('gate-a');
    expect(result).not.isNull();
    expect(result!.matchId).toBe('m1');
    expect(result!.minutesUntilKickoff).toBeCloseTo(30, 0);
  });
});
