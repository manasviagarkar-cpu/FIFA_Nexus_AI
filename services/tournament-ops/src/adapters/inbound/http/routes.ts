import { Router } from 'express';
import { TournamentController } from './controllers/tournament.controller';
import { MatchService } from '../../../domain/services/match.service';
import { StandingsService } from '../../../domain/services/standings.service';
import { PostgresAdapter } from '../../outbound/database/postgres.adapter';
import { RedisAdapter } from '../../outbound/cache/redis.adapter';
import { authenticateToken, requirePermission } from './middleware/auth.middleware';
import { validateBody } from './middleware/validation.middleware';
import { createMatchSchema, updateMatchSchema } from '../../../utils/validators';

export const createRouter = (): Router => {
  const router = Router();

  // Instantiate adapters
  const dbAdapter = new PostgresAdapter();
  const cacheAdapter = new RedisAdapter();

  // Instantiate services
  const matchService = new MatchService(dbAdapter, cacheAdapter);
  const standingsService = new StandingsService(dbAdapter, cacheAdapter);

  // Instantiate controller
  const controller = new TournamentController(matchService, standingsService);

  // Match routes
  router.post(
    '/matches',
    authenticateToken,
    requirePermission('system:configure'),
    validateBody(createMatchSchema),
    controller.createMatch
  );

  router.get('/matches', controller.listMatches);
  router.get('/matches/:id', controller.getMatch);

  router.patch(
    '/matches/:id',
    authenticateToken,
    requirePermission('system:configure'),
    validateBody(updateMatchSchema),
    controller.updateMatch
  );

  router.delete(
    '/matches/:id',
    authenticateToken,
    requirePermission('system:configure'),
    controller.deleteMatch
  );

  // Upcoming matches at a specific venue (integration endpoint)
  router.get('/matches/venue/:venueId/upcoming', controller.getUpcomingMatchForVenue);

  // Standings routes
  router.get('/standings', controller.getAllStandings);
  router.get('/standings/group/:groupId', controller.getStandingsForGroup);

  return router;
};
