import { Pool } from 'pg';
import { Match, MatchStatus, TournamentStage } from '@shared/tournament-ops';
import { MatchRepository } from '../../../domain/ports/outbound.ports';
import { pool } from '../../../infrastructure/database';
import { logger } from '../../../infrastructure/logger';

export class PostgresAdapter implements MatchRepository {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  async save(m: Match): Promise<void> {
    const query = `
      INSERT INTO matches 
      (match_id, group_id, stage, home_team, away_team, venue_id, venue_name, kickoff_time, status, home_score, away_score, minute, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `;
    await this.pool.query(query, [
      m.matchId,
      m.groupId,
      m.stage,
      m.homeTeam,
      m.awayTeam,
      m.venueId,
      m.venueName,
      new Date(m.kickoffTime),
      m.status,
      m.homeScore,
      m.awayScore,
      m.minute,
      new Date(m.createdAt),
      new Date(m.updatedAt),
    ]);
  }

  async findById(matchId: string): Promise<Match | null> {
    const query = `
      SELECT match_id, group_id, stage, home_team, away_team, venue_id, venue_name, kickoff_time, status, home_score, away_score, minute, created_at, updated_at
      FROM matches
      WHERE match_id = $1
    `;
    const res = await this.pool.query(query, [matchId]);
    if (res.rows.length === 0) return null;
    return this.rowToMatch(res.rows[0]);
  }

  async findAll(): Promise<Match[]> {
    const query = `
      SELECT match_id, group_id, stage, home_team, away_team, venue_id, venue_name, kickoff_time, status, home_score, away_score, minute, created_at, updated_at
      FROM matches
      ORDER BY kickoff_time ASC
    `;
    const res = await this.pool.query(query);
    return res.rows.map((row) => this.rowToMatch(row));
  }

  async update(matchId: string, m: Partial<Match>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (m.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(m.status);
    }
    if (m.homeScore !== undefined) {
      fields.push(`home_score = $${idx++}`);
      values.push(m.homeScore);
    }
    if (m.awayScore !== undefined) {
      fields.push(`away_score = $${idx++}`);
      values.push(m.awayScore);
    }
    if (m.minute !== undefined) {
      fields.push(`minute = $${idx++}`);
      values.push(m.minute);
    }
    if (m.updatedAt !== undefined) {
      fields.push(`updated_at = $${idx++}`);
      values.push(new Date(m.updatedAt));
    }

    if (fields.length === 0) return;

    values.push(matchId);
    const query = `
      UPDATE matches
      SET ${fields.join(', ')}
      WHERE match_id = $${idx}
    `;
    await this.pool.query(query, values);
  }

  async delete(matchId: string): Promise<boolean> {
    const query = `
      DELETE FROM matches
      WHERE match_id = $1
    `;
    const res = await this.pool.query(query, [matchId]);
    return (res.rowCount ?? 0) > 0;
  }

  async findUpcomingByVenue(venueId: string): Promise<Match[]> {
    const query = `
      SELECT match_id, group_id, stage, home_team, away_team, venue_id, venue_name, kickoff_time, status, home_score, away_score, minute, created_at, updated_at
      FROM matches
      WHERE venue_id = $1 AND kickoff_time >= NOW() - INTERVAL '2 hours'
      ORDER BY kickoff_time ASC
    `;
    const res = await this.pool.query(query, [venueId]);
    return res.rows.map((row) => this.rowToMatch(row));
  }

  private rowToMatch(row: any): Match {
    return {
      matchId: row.match_id,
      groupId: row.group_id,
      stage: row.stage as TournamentStage,
      homeTeam: row.home_team,
      awayTeam: row.away_team,
      venueId: row.venue_id,
      venueName: row.venue_name,
      kickoffTime: row.kickoff_time.toISOString(),
      status: row.status as MatchStatus,
      homeScore: row.home_score,
      awayScore: row.away_score,
      minute: row.minute,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
