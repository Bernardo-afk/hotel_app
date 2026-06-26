import request from 'supertest';
import jwt from 'jsonwebtoken';
import Anthropic from '@anthropic-ai/sdk';
import { createApp } from '../../app';
import * as ocrService from './ocr.service';

// Auto-mock the Anthropic SDK so new Anthropic(...) returns a controllable mock
jest.mock('@anthropic-ai/sdk');

const MockedAnthropic = Anthropic as jest.MockedClass<typeof Anthropic>;

const tenantId = 'tenant-ocr-1';
const cleanerToken = () =>
  'Bearer ' +
  jwt.sign({ id: 'cleaner-1', tenantId, role: 'CLEANER' }, process.env.JWT_SECRET!, {
    expiresIn: '1h',
  });

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Unit tests: extractAmount ──────────────────────────────────────────────

describe('extractAmount', () => {
  test('parses JSON response → returns { amount: 42.50, confidence: HIGH }', async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: '{"amount": 42.50, "confidence": "HIGH"}' }],
    });
    MockedAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }) as unknown as Anthropic);

    const result = await ocrService.extractAmount('base64data', 'image/jpeg');

    expect(result.amount).toBe(42.5);
    expect(result.confidence).toBe('HIGH');
  });

  test('handles malformed JSON response → returns { amount: 0, confidence: LOW }', async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'not valid json at all' }],
    });
    MockedAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }) as unknown as Anthropic);

    const result = await ocrService.extractAmount('base64data', 'image/png');

    expect(result.amount).toBe(0);
    expect(result.confidence).toBe('LOW');
  });
});

// ── Router test: POST /ocr/extract ────────────────────────────────────────

describe('POST /ocr/extract', () => {
  const app = createApp();

  test('returns 200 with amount when extractAmount resolves', async () => {
    jest.spyOn(ocrService, 'extractAmount').mockResolvedValue({ amount: 42.5, confidence: 'HIGH' });

    const res = await request(app)
      .post('/ocr/extract')
      .set('Authorization', cleanerToken())
      .send({ imageBase64: 'abc123', mediaType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(42.5);
    expect(res.body.confidence).toBe('HIGH');
  });

  test('returns 400 when body is missing required fields', async () => {
    const res = await request(app)
      .post('/ocr/extract')
      .set('Authorization', cleanerToken())
      .send({});

    expect(res.status).toBe(400);
  });

  test('returns 401 when unauthenticated', async () => {
    const res = await request(app)
      .post('/ocr/extract')
      .send({ imageBase64: 'abc123', mediaType: 'image/jpeg' });

    expect(res.status).toBe(401);
  });
});
