import { TranslationResponse, StadiumQueryResponse } from '@shared/fan-assistance';
import { SupportedLanguage } from '@shared/common';

export interface TranslationUseCase {
  translate(
    text: string,
    sourceLang: SupportedLanguage | undefined,
    targetLang: SupportedLanguage,
    context?: string,
    userId?: string
  ): Promise<TranslationResponse>;
}

export interface StadiumQueryUseCase {
  ask(
    query: string,
    language: SupportedLanguage,
    currentZoneId?: string,
    userId?: string,
    maxRelated?: number
  ): Promise<StadiumQueryResponse>;
}

export interface FeedbackUseCase {
  submitFeedback(
    userId: string,
    interactionType: 'translation' | 'stadium_query',
    interactionId: string,
    rating: number,
    comment?: string
  ): Promise<{ feedbackId: string; acknowledged: boolean; message: string }>;
}
