import { FeedbackUseCase } from '../ports/inbound.ports';
import { FeedbackRepository } from '../ports/outbound.ports';
import { logger } from '../../infrastructure/logger';

export class FeedbackService implements FeedbackUseCase {
  constructor(private feedbackRepo: FeedbackRepository) {}

  async submitFeedback(
    userId: string,
    interactionType: 'translation' | 'stadium_query',
    interactionId: string,
    rating: number,
    comment?: string
  ) {
    logger.info(
      `Submitting feedback for ${interactionType} interaction ${interactionId} by user ${userId}`
    );

    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be an integer between 1 and 5 inclusive.');
    }

    const feedbackId = await this.feedbackRepo.saveFeedback(
      userId,
      interactionType,
      interactionId,
      rating,
      comment
    );

    return {
      feedbackId,
      acknowledged: true,
      message:
        'Feedback received successfully. Thank you for helping optimize the tournament experience.',
    };
  }
}
