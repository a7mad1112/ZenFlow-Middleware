import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('POST /api/webhooks/:pipelineId', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns 202 Accepted when webhook is ingested', async () => {
    const ingestWebhookMock = jest.fn(async () => ({
      id: 'log_test_1',
      jobId: 'job_test_1',
      createdAt: '2026-03-22T00:00:00.000Z',
    }));

    jest.unstable_mockModule('../../src/api/controllers/webhook.controller.js', () => ({
      ingestWebhook: ingestWebhookMock,
      getTaskStatus: jest.fn(),
    }));

    const { setupWebhookRoutes } = await import('../../src/api/routes/webhook.routes.js');

    const app = express();
    app.use(express.json());
    setupWebhookRoutes(app);

    const res = await request(app)
      .post('/api/webhooks/pipeline-123')
      .send({ eventType: 'order.created', orderId: 'ORD-1001' });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.logId).toBe('log_test_1');
    expect(res.body.jobId).toBe('job_test_1');
    expect(ingestWebhookMock).toHaveBeenCalledTimes(1);
  });
});
