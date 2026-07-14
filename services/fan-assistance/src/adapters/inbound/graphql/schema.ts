export const typeDefs = `#graphql
  enum UserRole {
    fan
    staff
    admin
  }

  enum SupportedLanguage {
    en
    es
    fr
    ar
    pt
    de
    ja
    zh
    ko
    hi
    it
    nl
  }

  type LanguageInfo {
    code: SupportedLanguage!
    nameEnglish: String!
    nameNative: String!
    isRTL: Boolean!
  }

  type TranslationResponse {
    translatedText: String!
    sourceLanguage: SupportedLanguage!
    targetLanguage: SupportedLanguage!
    confidence: Float!
    altText: String!
    cached: Boolean!
    translatedAt: String!
  }

  type QuerySource {
    title: String!
    type: String!
    url: String
    relevance: Float!
  }

  type StadiumQueryResponse {
    answer: String!
    sources: [QuerySource!]!
    relatedQueries: [String!]!
    altText: String!
    accessibilityNotes: String
    language: SupportedLanguage!
    cached: Boolean!
    respondedAt: String!
  }

  type FeedbackResponse {
    feedbackId: String!
    acknowledged: Boolean!
    message: String!
  }

  input TranslationInput {
    text: String!
    sourceLanguage: SupportedLanguage
    targetLanguage: SupportedLanguage!
    context: String
  }

  input StadiumQueryInput {
    query: String!
    language: SupportedLanguage!
    currentZoneId: String
    maxRelatedQueries: Int
  }

  input FeedbackInput {
    interactionType: String!
    interactionId: String!
    rating: Int!
    comment: String
  }

  type Query {
    translate(input: TranslationInput!): TranslationResponse!
    askStadium(input: StadiumQueryInput!): StadiumQueryResponse!
    supportedLanguages: [LanguageInfo!]!
  }

  type Mutation {
    submitFeedback(input: FeedbackInput!): FeedbackResponse!
  }
`;
