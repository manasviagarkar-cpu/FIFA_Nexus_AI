import { StadiumQueryResponse } from '@shared/fan-assistance';
import { SupportedLanguage } from '@shared/common';
import { StadiumQueryUseCase } from '../ports/inbound.ports';
import { GeminiPort, StadiumContextRepository, CachePort } from '../ports/outbound.ports';
import { logger } from '../../infrastructure/logger';

export class StadiumQueryService implements StadiumQueryUseCase {
  constructor(
    private gemini: GeminiPort,
    private contextRepo: StadiumContextRepository,
    private cache: CachePort
  ) {}

  async ask(
    query: string,
    language: SupportedLanguage,
    currentZoneId?: string,
    userId?: string,
    maxRelated: number = 3
  ): Promise<StadiumQueryResponse> {
    if (!query.trim()) {
      throw new Error('Query text must not be empty.');
    }

    const cleanedQuery = query.trim();
    logger.info(`Stadium query received: "${cleanedQuery.slice(0, 30)}..." in language ${language}. Zone: ${currentZoneId}`);

    // Check Redis cache for exact query matches (5 mins TTL)
    const cacheKey = `query:${cleanedQuery.toLowerCase()}:${language}:${currentZoneId || 'none'}`;
    const cached = await this.cache.get<StadiumQueryResponse>(cacheKey);
    if (cached) {
      logger.info('Query served from Redis memory cache.');
      return { ...cached, cached: true };
    }

    // Fetch live context (e.g. current occupancy, capacity, events, facilities layout)
    let contextString = '';
    try {
      contextString = await this.contextRepo.getStadiumStateContext(currentZoneId);
    } catch (err) {
      logger.error('Failed to retrieve stadium database context:', err);
    }

    // Fetch response from Gemini SDK
    try {
      const geminiResult = await this.gemini.answerStadiumQuery(cleanedQuery, language, contextString);

      const response: StadiumQueryResponse = {
        answer: geminiResult.answer,
        sources: geminiResult.sources.slice(0, 3).map(s => ({
          title: s.title,
          type: s.type as any,
          url: s.url,
          relevance: s.relevance,
        })),
        relatedQueries: geminiResult.relatedQueries.slice(0, maxRelated),
        altText: `AI Answer in ${language}: "${geminiResult.answer.slice(0, 100)}..."`,
        accessibilityNotes: geminiResult.accessibilityNotes || 'Information presented in clear text structure suitable for screen readers.',
        language,
        cached: false,
        respondedAt: new Date().toISOString(),
      };

      // Save to cache (5 minutes TTL)
      await this.cache.set(cacheKey, response, 300);

      return response;
    } catch (err: any) {
      logger.error('Gemini query execution failed:', err);
      throw new Error(`AI processing failure: ${err.message}`);
    }
  }
}
