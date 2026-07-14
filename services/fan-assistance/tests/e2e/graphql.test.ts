import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { typeDefs } from '../../src/adapters/inbound/graphql/schema';
import { createTranslationResolver } from '../../src/adapters/inbound/graphql/resolvers/translation.resolver';
import { createStadiumResolver } from '../../src/adapters/inbound/graphql/resolvers/stadium.resolver';
import { config } from '../../src/config';
import { UserRole } from '@shared/auth';

// Mock dependency services
const mockTranslationService = {
  translate: jest.fn().mockResolvedValue({
    translatedText: 'Hola',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    confidence: 1.0,
    altText: 'Translated Hola',
    cached: false,
    translatedAt: new Date().toISOString(),
  }),
};

const mockStadiumQueryService = {
  ask: jest.fn().mockResolvedValue({
    answer: 'Welcome to MetLife.',
    sources: [],
    relatedQueries: [],
    altText: 'AI Answer: Welcome',
    accessibilityNotes: 'Access notes',
    language: 'en',
    cached: false,
    respondedAt: new Date().toISOString(),
  }),
};

const mockFeedbackService = {
  submitFeedback: jest.fn().mockResolvedValue({
    feedbackId: 'feed-123',
    acknowledged: true,
    message: 'Thanks',
  }),
};

describe('Fan Assistance GraphQL E2E Tests', () => {
  let app: express.Express;
  let server: ApolloServer;
  let userToken: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    const resolvers = {
      Query: {
        ...createTranslationResolver(mockTranslationService as any).Query,
        ...createStadiumResolver(mockStadiumQueryService as any, mockFeedbackService as any).Query,
      },
      Mutation: {
        ...createStadiumResolver(mockStadiumQueryService as any, mockFeedbackService as any).Mutation,
      },
    };

    server = new ApolloServer({ typeDefs, resolvers });
    await server.start();

    app.use(
      '/graphql',
      expressMiddleware(server, {
        context: async ({ req }) => {
          const authHeader = req.headers.authorization;
          const token = authHeader && authHeader.split(' ')[1];
          let user;
          if (token) {
            user = jwt.verify(token, config.auth.jwtSecret);
          }
          return { user };
        },
      })
    );

    userToken = jwt.sign(
      { sub: 'fan-001', role: UserRole.FAN, name: 'Alex', email: 'alex@fifa.com' },
      config.auth.jwtSecret
    );
  });

  afterAll(async () => {
    await server.stop();
  });

  it('should return 401 unauthenticated error when requesting translate without JWT', async () => {
    const query = `
      query Translate {
        translate(input: { text: "Hello", targetLanguage: es }) {
          translatedText
        }
      }
    `;

    const res = await request(app)
      .post('/graphql')
      .send({ query });

    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });

  it('should successfully execute translate query with valid JWT', async () => {
    const query = `
      query Translate {
        translate(input: { text: "Hello", targetLanguage: es }) {
          translatedText
          targetLanguage
        }
      }
    `;

    const res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ query });

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.translate.translatedText).toBe('Hola');
    expect(res.body.data.translate.targetLanguage).toBe('es');
  });

  it('should successfully execute askStadium query with valid JWT', async () => {
    const query = `
      query AskStadium {
        askStadium(input: { query: "Tell me about MetLife", language: en }) {
          answer
          accessibilityNotes
        }
      }
    `;

    const res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ query });

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.askStadium.answer).toBe('Welcome to MetLife.');
  });
});
