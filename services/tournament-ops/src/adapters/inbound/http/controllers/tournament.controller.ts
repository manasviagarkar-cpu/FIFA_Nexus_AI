import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { MatchUseCase, StandingsUseCase } from '../../../../domain/ports/inbound.ports';

export class TournamentController {
  constructor(
    private matchUseCase: MatchUseCase,
    private standingsUseCase: StandingsUseCase
  ) {}

  createMatch = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const match = await this.matchUseCase.createMatch(req.body);
      return res.status(201).json({
        success: true,
        data: match,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          traceId: crypto.randomUUID(),
        },
      });
    } catch (err) {
      next(err);
    }
  };

  getMatch = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const matchId = req.params.id;
      const match = await this.matchUseCase.getMatch(matchId);
      if (!match) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Match with ID ${matchId} not found.`,
            statusCode: 404,
            timestamp: new Date().toISOString(),
          },
        });
      }
      return res.status(200).json({
        success: true,
        data: match,
      });
    } catch (err) {
      next(err);
    }
  };

  listMatches = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const matches = await this.matchUseCase.listMatches();
      return res.status(200).json({
        success: true,
        data: matches,
      });
    } catch (err) {
      next(err);
    }
  };

  updateMatch = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const matchId = req.params.id;
      const match = await this.matchUseCase.updateMatch(matchId, req.body);
      return res.status(200).json({
        success: true,
        data: match,
      });
    } catch (err) {
      next(err);
    }
  };

  deleteMatch = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const matchId = req.params.id;
      const success = await this.matchUseCase.deleteMatch(matchId);
      if (!success) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Match with ID ${matchId} not found.`,
            statusCode: 404,
            timestamp: new Date().toISOString(),
          },
        });
      }
      return res.status(200).json({
        success: true,
        data: { message: 'Match deleted successfully.' },
      });
    } catch (err) {
      next(err);
    }
  };

  getUpcomingMatchForVenue = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const venueId = req.params.venueId;
      const upcoming = await this.matchUseCase.getUpcomingMatchForVenue(venueId);
      if (!upcoming) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `No upcoming match scheduled at venue ${venueId}.`,
            statusCode: 404,
            timestamp: new Date().toISOString(),
          },
        });
      }
      return res.status(200).json({
        success: true,
        data: upcoming,
      });
    } catch (err) {
      next(err);
    }
  };

  getStandingsForGroup = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const groupId = req.params.groupId;
      const standings = await this.standingsUseCase.getStandings(groupId);
      return res.status(200).json({
        success: true,
        data: standings,
      });
    } catch (err) {
      next(err);
    }
  };

  getAllStandings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const standings = await this.standingsUseCase.computeStandings();
      return res.status(200).json({
        success: true,
        data: standings,
      });
    } catch (err) {
      next(err);
    }
  };
}
