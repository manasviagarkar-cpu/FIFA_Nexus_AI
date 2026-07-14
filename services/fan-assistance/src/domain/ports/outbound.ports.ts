import { TranslationResponse, StadiumQueryResponse } from '@shared/fan-assistance';

export interface TranslationCacheRepository {
  getCachedTranslation(textHash: string, sourceLang: string, targetLang: string, context?: string): Promise<TranslationResponse | null>;
  saveTranslationToCache(textHash: string, sourceLang: string, targetLang: string, translation: TranslationResponse, context?: string): Promise<void>;
}

export interface FeedbackRepository {
  saveFeedback(userId: string, type: string, interactionId: string, rating: number, comment?: string): Promise<string>;
}

export interface GeminiPort {
  translateText(text: string, targetLanguage: string, context?: string): Promise<{ translatedText: string; sourceLanguage: string; confidence: number }>;
  answerStadiumQuery(query: string, language: string, contextString?: string): Promise<{ answer: string; sources: { title: string; type: string; url?: string; relevance: number }[]; relatedQueries: string[]; accessibilityNotes?: string }>;
}

export interface CachePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}

export interface StadiumContextRepository {
  getStadiumStateContext(zoneId?: string): Promise<string>;
}
