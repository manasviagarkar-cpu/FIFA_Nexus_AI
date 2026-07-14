import { TranslationService } from '../../src/domain/services/translation.service';
import { TranslationCacheRepository, GeminiPort, CachePort } from '../../src/domain/ports/outbound.ports';
import { SupportedLanguage } from '@shared/common';

describe('TranslationService Unit Tests', () => {
  let translationService: TranslationService;
  let mockCacheRepo: jest.Mocked<TranslationCacheRepository>;
  let mockGemini: jest.Mocked<GeminiPort>;
  let mockCache: jest.Mocked<CachePort>;

  beforeEach(() => {
    mockCacheRepo = {
      getCachedTranslation: jest.fn().mockResolvedValue(null),
      saveTranslationToCache: jest.fn().mockResolvedValue(undefined),
    };

    mockGemini = {
      translateText: jest.fn().mockResolvedValue({
        translatedText: 'Hola, bienvenido al estadio.',
        sourceLanguage: 'en',
        confidence: 0.99,
      }),
      answerStadiumQuery: jest.fn(),
    };

    mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    translationService = new TranslationService(mockCacheRepo, mockGemini, mockCache);
  });

  it('should translate text calling Gemini if not cached and save to cache', async () => {
    const text = 'Hello, welcome to the stadium.';
    const result = await translationService.translate(text, undefined, SupportedLanguage.ES, 'general');

    expect(result.translatedText).toBe('Hola, bienvenido al estadio.');
    expect(result.sourceLanguage).toBe('en');
    expect(result.targetLanguage).toBe('es');
    expect(result.cached).toBe(false);

    expect(mockGemini.translateText).toHaveBeenCalledWith(text, 'es', 'general');
    expect(mockCacheRepo.saveTranslationToCache).toHaveBeenCalled();
    expect(mockCache.set).toHaveBeenCalled();
  });

  it('should serve translation from Redis memory cache if present', async () => {
    const text = 'Hello, welcome to the stadium.';
    const cachedResponse = {
      translatedText: 'Hola, bienvenido al estadio.',
      sourceLanguage: SupportedLanguage.EN,
      targetLanguage: SupportedLanguage.ES,
      confidence: 0.99,
      altText: 'Translation: ...',
      cached: true,
      translatedAt: new Date().toISOString(),
    };
    mockCache.get.mockResolvedValueOnce(cachedResponse);

    const result = await translationService.translate(text, undefined, SupportedLanguage.ES, 'general');

    expect(result.translatedText).toBe('Hola, bienvenido al estadio.');
    expect(result.cached).toBe(true);
    expect(mockGemini.translateText).not.toHaveBeenCalled();
  });
});
