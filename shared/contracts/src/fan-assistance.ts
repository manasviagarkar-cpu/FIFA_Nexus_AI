// ============================================================================
// FIFA Nexus AI — Shared Contracts: Fan Assistance Types
// ============================================================================

import { SupportedLanguage } from './common';

/** Translation request */
export interface TranslationRequest {
  /** Text to translate */
  text: string;
  /** Source language (auto-detect if not provided) */
  sourceLanguage?: SupportedLanguage;
  /** Target language */
  targetLanguage: SupportedLanguage;
  /** Context for better translation (e.g., 'stadium_navigation', 'food_order') */
  context?: TranslationContext;
  /** User ID for personalization */
  userId?: string;
}

/** Translation context categories */
export type TranslationContext =
  | 'stadium_navigation'
  | 'food_order'
  | 'merchandise'
  | 'emergency'
  | 'general_inquiry'
  | 'match_information'
  | 'transportation'
  | 'medical';

/** Translation response */
export interface TranslationResponse {
  /** Translated text */
  translatedText: string;
  /** Detected or provided source language */
  sourceLanguage: SupportedLanguage;
  /** Target language */
  targetLanguage: SupportedLanguage;
  /** Translation confidence score (0.0 - 1.0) */
  confidence: number;
  /** Alt-text for accessibility */
  altText: string;
  /** Whether result was served from cache */
  cached: boolean;
  /** Translation timestamp */
  translatedAt: string;
}

/** Stadium query request */
export interface StadiumQueryRequest {
  /** User's question/query */
  query: string;
  /** Preferred response language */
  language: SupportedLanguage;
  /** Query category for routing */
  category?: QueryCategory;
  /** User's current location for contextual responses */
  currentZoneId?: string;
  /** User ID for personalization */
  userId?: string;
  /** Maximum number of related queries to suggest */
  maxRelatedQueries?: number;
}

/** Query categories */
export type QueryCategory =
  | 'facilities'
  | 'schedule'
  | 'food_beverage'
  | 'transportation'
  | 'rules_policies'
  | 'accessibility'
  | 'emergency'
  | 'entertainment'
  | 'general';

/** Stadium query response */
export interface StadiumQueryResponse {
  /** AI-generated answer */
  answer: string;
  /** Source references */
  sources: QuerySource[];
  /** Suggested related queries */
  relatedQueries: string[];
  /** Alt-text for accessibility */
  altText: string;
  /** Accessibility-specific notes */
  accessibilityNotes?: string;
  /** Response language */
  language: SupportedLanguage;
  /** Whether result was served from cache */
  cached: boolean;
  /** Response timestamp */
  respondedAt: string;
}

/** Source reference for query answers */
export interface QuerySource {
  /** Source title */
  title: string;
  /** Source type */
  type: 'official_faq' | 'stadium_guide' | 'match_schedule' | 'policy_document' | 'ai_generated';
  /** Source URL if available */
  url?: string;
  /** Relevance score (0.0 - 1.0) */
  relevance: number;
}

/** Language information */
export interface LanguageInfo {
  /** Language code */
  code: SupportedLanguage;
  /** Language name in English */
  nameEnglish: string;
  /** Language name in native script */
  nameNative: string;
  /** Whether RTL layout is needed */
  isRTL: boolean;
}

/** Supported languages metadata */
export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: SupportedLanguage.EN, nameEnglish: 'English', nameNative: 'English', isRTL: false },
  { code: SupportedLanguage.ES, nameEnglish: 'Spanish', nameNative: 'Español', isRTL: false },
  { code: SupportedLanguage.FR, nameEnglish: 'French', nameNative: 'Français', isRTL: false },
  { code: SupportedLanguage.AR, nameEnglish: 'Arabic', nameNative: 'العربية', isRTL: true },
  { code: SupportedLanguage.PT, nameEnglish: 'Portuguese', nameNative: 'Português', isRTL: false },
  { code: SupportedLanguage.DE, nameEnglish: 'German', nameNative: 'Deutsch', isRTL: false },
  { code: SupportedLanguage.JA, nameEnglish: 'Japanese', nameNative: '日本語', isRTL: false },
  { code: SupportedLanguage.ZH, nameEnglish: 'Chinese', nameNative: '中文', isRTL: false },
  { code: SupportedLanguage.KO, nameEnglish: 'Korean', nameNative: '한국어', isRTL: false },
  { code: SupportedLanguage.HI, nameEnglish: 'Hindi', nameNative: 'हिन्दी', isRTL: false },
  { code: SupportedLanguage.IT, nameEnglish: 'Italian', nameNative: 'Italiano', isRTL: false },
  { code: SupportedLanguage.NL, nameEnglish: 'Dutch', nameNative: 'Nederlands', isRTL: false },
];

/** Feedback submission */
export interface FeedbackRequest {
  /** Type of interaction being rated */
  interactionType: 'translation' | 'stadium_query';
  /** Reference ID of the interaction */
  interactionId: string;
  /** Rating (1-5) */
  rating: number;
  /** Optional comment */
  comment?: string;
  /** User ID */
  userId: string;
}

/** Feedback response */
export interface FeedbackResponse {
  feedbackId: string;
  acknowledged: boolean;
  message: string;
}
