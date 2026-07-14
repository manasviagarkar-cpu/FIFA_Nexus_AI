import { GoogleGenAI } from '@google/generative-ai';
import { GeminiPort } from '../../../domain/ports/outbound.ports';
import { config } from '../../../config';
import { logger } from '../../../infrastructure/logger';

export class GeminiAdapter implements GeminiPort {
  private ai: any;
  private modelName: string;

  constructor() {
    this.modelName = config.gemini.model || 'gemini-2.5-pro';
    if (config.gemini.apiKey) {
      // Use the official SDK syntax
      this.ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
    } else {
      logger.warn('GEMINI_API_KEY is not defined. Fan Assistance Gemini queries will fall back to mocked answers.');
    }
  }

  async translateText(text: string, targetLanguage: string, context?: string): Promise<{ translatedText: string; sourceLanguage: string; confidence: number }> {
    if (!this.ai) {
      logger.info('Gemini API key missing. Mocking translation output.');
      return {
        translatedText: `[Mocked Translation to ${targetLanguage}]: ${text}`,
        sourceLanguage: 'en',
        confidence: 0.95,
      };
    }

    try {
      const model = this.ai.getGenerativeModel({ model: this.modelName });
      const prompt = `
        You are a translation assistant for the FIFA World Cup 2026 Smart Stadium operations.
        Translate the following text into target language "${targetLanguage}".
        Context category of conversation: ${context || 'general stadium operations'}.
        
        Provide only the translated text. Do not add any introductory phrases or markdown fences.
        
        Text to translate:
        "${text}"
      `;

      const response = await model.generateContent({ contents: prompt });
      const resultText = response.text || '';
      return {
        translatedText: resultText.trim(),
        sourceLanguage: 'en', // default assumed
        confidence: 0.98,
      };
    } catch (err: any) {
      logger.error('Gemini translation API execution error:', err);
      // Fallback
      return {
        translatedText: `[Fallback Translation to ${targetLanguage}]: ${text}`,
        sourceLanguage: 'en',
        confidence: 0.5,
      };
    }
  }

  async answerStadiumQuery(
    query: string,
    language: string,
    contextString?: string
  ): Promise<{
    answer: string;
    sources: { title: string; type: string; url?: string; relevance: number }[];
    relatedQueries: string[];
    accessibilityNotes?: string;
  }> {
    if (!this.ai) {
      logger.info('Gemini API key missing. Mocking stadium query output.');
      return {
        answer: `I am currently running in offline mock mode. You asked: "${query}". I see you prefer language: "${language}". Please set GEMINI_API_KEY to see live responses.`,
        sources: [{ title: 'Offline System Mock', type: 'ai_generated', relevance: 1.0 }],
        relatedQueries: ['Where is gate A?', 'How do I access wheelchair assistance?'],
        accessibilityNotes: 'This is a test offline message.',
      };
    }

    try {
      const model = this.ai.getGenerativeModel({
        model: this.modelName,
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });

      const prompt = `
        You are "FIFA Nexus AI", an advanced, friendly Multilingual Stadium Fan Assistant for the 2026 FIFA World Cup.
        Answer the fan query using the provided live stadium state context. Respond in the fan's preferred language: "${language}".
        
        Keep answers clear, highly accurate, and friendly. Provide accessibility-specific details if relevant (e.g. elevators, stairs, ramps, clear paths).
        
        Live Stadium State Context:
        """
        ${contextString || 'No live data available.'}
        """
        
        Fan Query:
        "${query}"
        
        You must return a JSON object with the following exact structure:
        {
          "answer": "Your detailed friendly response in ${language}",
          "sources": [
            { "title": "Source page/section name", "type": "official_faq" or "stadium_guide" or "match_schedule" or "policy_document", "url": "optional url", "relevance": 0.95 }
          ],
          "relatedQueries": ["Suggested question 1", "Suggested question 2"],
          "accessibilityNotes": "A text summary of key physical access features mentioned (ramps, elevators, noise levels) for screen readers, or leave empty if none."
        }
      `;

      const response = await model.generateContent({ contents: prompt });
      const jsonText = response.text || '{}';
      const result = JSON.parse(jsonText);

      return {
        answer: result.answer || 'I am sorry, I could not formulate an answer.',
        sources: result.sources || [{ title: 'Official Stadium FAQ', type: 'official_faq', relevance: 0.8 }],
        relatedQueries: result.relatedQueries || [],
        accessibilityNotes: result.accessibilityNotes,
      };
    } catch (err: any) {
      logger.error('Gemini query execution error:', err);
      return {
        answer: 'I am experiencing connection issues. Please locate a physical stadium volunteer or info booth.',
        sources: [{ title: 'Emergency Fallback Support', type: 'policy_document', relevance: 1.0 }],
        relatedQueries: ['Where is the nearest medical station?'],
      };
    }
  }
}
