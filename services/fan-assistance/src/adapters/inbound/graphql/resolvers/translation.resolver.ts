import { TranslationUseCase } from '../../../../domain/ports/inbound.ports';
import { JWTPayload } from '@shared/auth';
import { GraphQLError } from 'graphql';
import { logger } from '../../../../infrastructure/logger';

export const createTranslationResolver = (translationService: TranslationUseCase) => {
  return {
    Query: {
      translate: async (
        _: any,
        {
          input,
        }: {
          input: {
            text: string;
            sourceLanguage?: string;
            targetLanguage: string;
            context?: string;
          };
        },
        context: { user?: JWTPayload }
      ) => {
        // Enforce basic auth check
        if (!context.user) {
          throw new GraphQLError('Unauthorized. Access token is missing or invalid.', {
            extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
          });
        }

        try {
          return await translationService.translate(
            input.text,
            input.sourceLanguage as any,
            input.targetLanguage as any,
            input.context,
            context.user.sub
          );
        } catch (err: any) {
          logger.error('Translate resolver failed:', err);
          throw new GraphQLError(err.message, {
            extensions: { code: 'TRANSLATE_FAILED', http: { status: 500 } },
          });
        }
      },
    },
  };
};
