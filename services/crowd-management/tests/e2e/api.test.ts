import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { createRouter } from '../../src/adapters/inbound/http/routes';
import { config } from '../../src/config';
import { UserRole } from '@shared/auth';
import { pool } from '../../src/infrastructure/database';
import { redisClient } from '../../src/infrastructure/redis';

// Mock DB infrastructure completely for e2e tests
jest.mock('../../src/infrastructure/database', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue({
      query: jest.fn(),
      release: jest.fn(),
    }),
  },
}));

jest.mock('../../src/infrastructure/redis', () => ({
  redisClient: {
    get: jest.fn(),
    set: jest.fn(),
    publish: jest.fn(),
    multi: jest.fn().mockReturnValue({
      zRemRangeByScore: jest.fn(),
      zAdd: jest.fn(),
      zCard: jest.fn(),
      expire: jest.fn(),
      exec: jest.fn().mockResolvedValue([0, 0, 1]), // rate limit response (1 request)
    }),
  },
}));

describe('Crowd Management E2E API Tests', () => {
  let app: express.Express;
  let adminToken: string;
  let fanToken: string;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1', createRouter());

    adminToken = jwt.sign(
      { sub: 'admin-1', role: UserRole.ADMIN, name: 'Taylor Admin', email: 'admin@fifa.com' },
      config.auth.jwtSecret
    );
    fanToken = jwt.sign(
      { sub: 'fan-1', role: UserRole.FAN, name: 'Alex Fan', email: 'fan@fifa.com' },
      config.auth.jwtSecret
    );
  });

  it('should return 401 when no token is provided', async () => {
    const res = await request(app).post('/api/v1/sensors/ingest').send({});
    expect(res.status).toBe(401);
  });

  it('should return 403 when fan attempts to ingest sensor data', async () => {
    const res = await request(app)
      .post('/api/v1/sensors/ingest')
      .set('Authorization', `Bearer ${fanToken}`)
      .send({
        readings: [],
        sourceSystem: 'test',
        batchId: 'batch-1',
      });
    expect(res.status).toBe(403);
  });

  it('should return 400 when admin sends invalid ingestion payload', async () => {
    const res = await request(app)
      .post('/api/v1/sensors/ingest')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        readings: [{ sensorId: 's1' }], // Missing fields
        sourceSystem: 'test',
        batchId: 'batch-1',
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should succeed when admin sends valid turnstile payload', async () => {
    const mockDb = pool as any;
    mockDb.connect.mockResolvedValueOnce({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    });
    mockDb.query.mockResolvedValue({ rows: [{ capacity: 1000, current_occupancy: 100 }] });

    const payload = {
      readings: [
        {
          sensorId: 'turn-a1',
          sensorType: 'turnstile',
          zoneId: 'gate-a',
          timestamp: new Date().toISOString(),
          payload: {
            type: 'turnstile',
            entriesCount: 10,
            exitsCount: 2,
            periodSeconds: 60,
            gateId: 'gate-a-gate1',
          },
        },
      ],
      sourceSystem: 'turnstile-systems',
      batchId: 'batch-success-123',
    };

    const res = await request(app)
      .post('/api/v1/sensors/ingest')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.processedCount).toBe(1);
  });
});
