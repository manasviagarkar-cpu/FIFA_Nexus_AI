import { StadiumQueryService } from '../../src/domain/services/stadium-query.service';
import { GeminiPort, StadiumContextRepository, CachePort } from '../../src/domain/ports/outbound.ports';
import { SupportedLanguage } from '@shared/common';

describe('StadiumQueryService Unit Tests', () => {
  let stadiumQueryService: StadiumQueryService;
  let mockGemini: jest.Mocked<GeminiPort>;
  let mockContextRepo: jest.Mocked<StadiumContextRepository>;
  let mockCache: jest.Mocked<CachePort>;

  beforeEach(() => {
    mockGemini = {
      translateText: jest.fn(),
      answerStadiumQuery: jest.fn().mockResolvedValue({
        answer: 'Gates open at 3:00 PM. Gate D is VIP only.',
        sources: [
          { title: 'Stadium Opening Policies FAQ', type: 'official_faq', relevance: 0.95 },
        ],
        relatedQueries: ['Where is gate D?', 'Can I bring clear bags?'],
        accessibilityNotes: 'Gate D has wheelchair elevator access.',
      }),
    };

    mockContextRepo = {
      getStadiumStateContext: jest.fn().mockResolvedValue('Mock DB Context Guides'),
    };

    mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    stadiumQueryService = new StadiumQueryService(mockGemini, mockContextRepo, mockCache);
  });

  it('should process Q&A using live db context feed and return structured response', async () => {
    const result = await stadiumQueryService.ask('When do stadium gates open?', SupportedLanguage.EN, 'gate-a');

    expect(result.answer).toBe('Gates open at 3:00 PM. Gate D is VIP only.');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].title).toBe('Stadium Opening Policies FAQ');
    expect(result.relatedQueries).toContain('Where is gate D?');
    expect(result.accessibilityNotes).toBe('Gate D has wheelchair elevator access.');

    expect(mockContextRepo.getStadiumStateContext).toHaveBeenCalledWith('gate-a');
    expect(mockGemini.answerStadiumQuery).toHaveBeenCalledWith('When do stadium gates open?', 'en', 'Mock DB Context Guides');
    expect(mockCache.set).toHaveBeenCalled();
  });
});
