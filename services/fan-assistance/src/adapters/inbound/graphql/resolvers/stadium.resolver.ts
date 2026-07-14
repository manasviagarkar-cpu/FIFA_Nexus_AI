import { StadiumQueryUseCase, FeedbackUseCase } from '../../../../domain/ports/inbound.ports';
import { SUPPORTED_LANGUAGES } from '@shared/fan-assistance';
import { JWTPayload } from '@shared/auth';
import { GraphQLError } from 'graphql';
import { logger } from '../../../../infrastructure/logger';

export const createStadiumResolver = (
  stadiumQueryService: StadiumQueryUseCase,
  feedbackService: FeedbackUseCase
) => {
  return {
    Query: {
      askStadium: async (
        _: any,
        {
          input,
        }: {
          input: {
            query: string;
            language: string;
            currentZoneId?: string;
            maxRelatedQueries?: number;
          };
        },
        context: { user?: JWTPayload }
      ) => {
        if (!context.user) {
          throw new GraphQLError('Unauthorized. Access token is missing or invalid.', {
            extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
          });
        }

        try {
          return await stadiumQueryService.ask(
            input.query,
            input.language as any,
            input.currentZoneId,
            context.user.sub,
            input.maxRelatedQueries
          );
        } catch (err: any) {
          logger.error('Ask stadium resolver failure:', err);
          throw new GraphQLError(err.message, {
            extensions: { code: 'STADIUM_QUERY_FAILED', http: { status: 500 } },
          });
        }
      },
      supportedLanguages: () => {
        return SUPPORTED_LANGUAGES.map((l) => ({
          code: l.code,
          nameEnglish: l.nameEnglish,
          nameNative: l.nameNative,
          isRTL: l.isRTL,
        }));
      },
    },

    Mutation: {
      submitFeedback: async (
        _: any,
        {
          input,
        }: {
          input: {
            interactionType: string;
            interactionId: string;
            rating: number;
            comment?: string;
          };
        },
        context: { user?: JWTPayload }
      ) => {
        if (!context.user) {
          throw new GraphQLError('Unauthorized.', {
            extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
          });
        }

        try {
          return await feedbackService.submitFeedback(
            context.user.sub,
            input.interactionType as any,
            input.interactionId,
            input.rating,
            input.comment
          );
        } catch (err: any) {
          logger.error('Submit feedback resolver failed:', err);
          throw new GraphQLError(err.message, {
            extensions: { code: 'FEEDBACK_FAILED', http: { status: 400 } },
          });
        }
      },
    },
  };
};
