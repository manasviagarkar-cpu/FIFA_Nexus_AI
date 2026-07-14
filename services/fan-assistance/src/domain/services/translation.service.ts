import crypto from 'crypto';
import { TranslationResponse } from '@shared/fan-assistance';
import { SupportedLanguage } from '@shared/common';
import { TranslationUseCase } from '../ports/inbound.ports';
import { TranslationCacheRepository, GeminiPort, CachePort } from '../ports/outbound.ports';
import { logger } from '../../infrastructure/logger';

export class TranslationService implements TranslationUseCase {
  constructor(
    private cacheRepo: TranslationCacheRepository,
    private gemini: GeminiPort,
    private cache: CachePort
  ) {}

  async translate(
    text: string,
    sourceLang: SupportedLanguage | undefined,
    targetLang: SupportedLanguage,
    context?: string,
    _userId?: string
  ): Promise<TranslationResponse> {
    if (!text.trim()) {
      throw new Error('Input text must not be empty.');
    }

    const cleanedText = text.trim();
    const textHash = crypto.createHash('sha256').update(cleanedText).digest('hex');
    const sourceLangStr = sourceLang || 'auto';

    logger.info(`Translation requested for text hash ${textHash.slice(0, 8)} to ${targetLang}`);

    // Check Redis memory cache first for ultra-fast fan response
    const cacheKey = `trans:${textHash}:${sourceLangStr}:${targetLang}:${context || 'general'}`;
    const cached = await this.cache.get<TranslationResponse>(cacheKey);
    if (cached) {
      logger.info('Translation served from Redis memory cache.');
      return { ...cached, cached: true };
    }

    // Check persistent database cache
    const dbCached = await this.cacheRepo.getCachedTranslation(
      textHash,
      sourceLangStr,
      targetLang,
      context
    );
    if (dbCached) {
      logger.info('Translation served from PostgreSQL database cache.');
      // Warm up Redis
      await this.cache.set(cacheKey, dbCached, 3600);
      return { ...dbCached, cached: true };
    }

    // Call Gemini API
    try {
      const geminiResult = await this.gemini.translateText(cleanedText, targetLang, context);

      const translationResponse: TranslationResponse = {
        translatedText: geminiResult.translatedText,
        sourceLanguage: geminiResult.sourceLanguage as SupportedLanguage,
        targetLanguage: targetLang,
        confidence: geminiResult.confidence,
        altText: `Translation from ${geminiResult.sourceLanguage} to ${targetLang}: "${geminiResult.translatedText}"`,
        cached: false,
        translatedAt: new Date().toISOString(),
      };

      // Save to DB cache
      await this.cacheRepo.saveTranslationToCache(
        textHash,
        geminiResult.sourceLanguage,
        targetLang,
        translationResponse,
        context
      );

      // Save to Redis cache (1 hour TTL)
      await this.cache.set(cacheKey, translationResponse, 3600);

      return translationResponse;
    } catch (err: any) {
      logger.error('Gemini translation operation failed:', err);
      throw new Error(`Translation failure: ${err.message}`);
    }
  }
}
