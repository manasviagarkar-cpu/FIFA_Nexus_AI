import { Pool } from 'pg';
import { TranslationResponse } from '@shared/fan-assistance';
import {
  TranslationCacheRepository,
  FeedbackRepository,
  StadiumContextRepository,
} from '../../../domain/ports/outbound.ports';
import { pool } from '../../../infrastructure/database';
import { logger } from '../../../infrastructure/logger';

export class PostgresAdapter
  implements TranslationCacheRepository, FeedbackRepository, StadiumContextRepository
{
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  // ============================================================================
  // TranslationCacheRepository
  // ============================================================================
  async getCachedTranslation(
    textHash: string,
    sourceLang: string,
    targetLang: string,
    context?: string
  ): Promise<TranslationResponse | null> {
    const query = `
      SELECT translated_text, source_language, target_language, confidence, created_at
      FROM translation_cache
      WHERE source_text_hash = $1 AND source_language = $2 AND target_language = $3 AND (context = $4 OR ($4 IS NULL AND context IS NULL))
    `;
    const res = await this.pool.query(query, [textHash, sourceLang, targetLang, context || null]);
    if (res.rows.length === 0) return null;

    // Increment hit count asynchronously
    this.pool
      .query(
        `UPDATE translation_cache SET hit_count = hit_count + 1 WHERE source_text_hash = $1 AND source_language = $2 AND target_language = $3`,
        [textHash, sourceLang, targetLang]
      )
      .catch((err) => logger.error('Failed to update translation hit count:', err));

    const row = res.rows[0];
    return {
      translatedText: row.translated_text,
      sourceLanguage: row.source_language as any,
      targetLanguage: row.target_language as any,
      confidence: parseFloat(row.confidence),
      altText: `Translation from ${row.source_language} to ${row.target_language}: "${row.translated_text}"`,
      cached: true,
      translatedAt: row.created_at.toISOString(),
    };
  }

  async saveTranslationToCache(
    textHash: string,
    sourceLang: string,
    targetLang: string,
    translation: TranslationResponse,
    context?: string
  ): Promise<void> {
    const query = `
      INSERT INTO translation_cache (source_text_hash, source_language, target_language, translated_text, confidence, context)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (source_text_hash, source_language, target_language, context) DO NOTHING
    `;
    await this.pool.query(query, [
      textHash,
      sourceLang,
      targetLang,
      translation.translatedText,
      translation.confidence,
      context || null,
    ]);
  }

  // ============================================================================
  // FeedbackRepository
  // ============================================================================
  async saveFeedback(
    userId: string,
    type: string,
    interactionId: string,
    rating: number,
    comment?: string
  ): Promise<string> {
    const query = `
      INSERT INTO feedback (user_id, interaction_type, interaction_id, rating, comment)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    const res = await this.pool.query(query, [
      userId,
      type,
      interactionId,
      rating,
      comment || null,
    ]);
    return res.rows[0].id;
  }

  // ============================================================================
  // StadiumContextRepository
  // ============================================================================
  async getStadiumStateContext(zoneId?: string): Promise<string> {
    let contextStr = '=== Live Stadium State Context ===\n';

    // Get current events or match info (mocked in SQL database for demonstration, let's pull all zones status)
    const zonesRes = await this.pool.query(
      `SELECT id, name, zone_type, capacity, current_occupancy FROM stadium_zones`
    );

    contextStr += 'Stadium Layout and Crowd Status:\n';
    for (const z of zonesRes.rows) {
      const ratio = z.current_occupancy / Math.max(1, z.capacity);
      contextStr += `- Zone "${z.id}" (${z.name}, type: ${z.zone_type}): Occupancy is ${z.current_occupancy}/${z.capacity} (${(ratio * 100).toFixed(0)}% full).\n`;
    }

    if (zoneId) {
      const targetZone = zonesRes.rows.find((z) => z.id === zoneId);
      if (targetZone) {
        contextStr += `\nFan Current Location: Fan is currently at "${targetZone.name}" (${zoneId}).\n`;
      }
    }

    // Add general static stadium guide FAQs
    contextStr += '\nGeneral Policies:\n';
    contextStr += '- Bag Policy: Only clear bags smaller than 12x6x12 inches are allowed.\n';
    contextStr += '- MedLife Stadium has gates A, B, C, D. Gate D is VIP only.\n';
    contextStr +=
      '- First Aid / Medical: Stations are located at Medical Station Alpha (level 0) and Medical Station Beta (level 2).\n';
    contextStr += '- Opening hours: Gates open 3 hours prior to kickoff.\n';
    contextStr += '- Re-entry: No re-entry is permitted once ticket is scanned.\n';

    return contextStr;
  }
}
