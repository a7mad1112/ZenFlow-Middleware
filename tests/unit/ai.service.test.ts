import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('AI Service', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns summary text from Gemini model response', async () => {
    const generateContent = jest.fn(async () => ({
      response: {
        text: () => 'Summary: Looks normal | Risk: Low | Reason: No suspicious indicators',
      },
    }));

    const getGenerativeModel = jest.fn(() => ({ generateContent }));
    const GoogleGenerativeAI = jest.fn(() => ({ getGenerativeModel }));

    jest.unstable_mockModule('@google/generative-ai', () => ({
      GoogleGenerativeAI,
    }));

    const { aiService } = await import('../../src/services/ai.service.js');

    const result = await aiService.summarizeOrder({ orderId: 'ORD-1001', total: 50 });

    expect(result).toContain('Risk: Low');
    expect(GoogleGenerativeAI).toHaveBeenCalledTimes(1);
    expect(getGenerativeModel).toHaveBeenCalledTimes(1);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('throws when Gemini returns empty content', async () => {
    const generateContent = jest.fn(async () => ({
      response: {
        text: () => '   ',
      },
    }));

    const getGenerativeModel = jest.fn(() => ({ generateContent }));
    const GoogleGenerativeAI = jest.fn(() => ({ getGenerativeModel }));

    jest.unstable_mockModule('@google/generative-ai', () => ({
      GoogleGenerativeAI,
    }));

    const { aiService } = await import('../../src/services/ai.service.js');

    await expect(
      aiService.summarizeOrder({ orderId: 'ORD-ERR', total: 10 })
    ).rejects.toThrow('Gemini returned an empty summary');
  });
});
