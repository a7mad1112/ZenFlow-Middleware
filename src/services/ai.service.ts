import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env.js';

class AIService {
  private client: GoogleGenerativeAI | null = null;

  private getClient(): GoogleGenerativeAI {
    if (this.client) {
      return this.client;
    }

    const apiKey = config.geminiApiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('GEMINI_API_KEY is not configured in .env');
    }

    this.client = new GoogleGenerativeAI(apiKey);
    return this.client;
  }

  async summarizeOrder(payload: any): Promise<string> {
    const model = this.getClient().getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction:
        'You are a business assistant. Analyze this JSON order and provide a one-sentence friendly summary for the team and a risk assessment (Low/Medium/High).',
    });

    const prompt = [
      'Analyze this order payload and provide the requested concise summary.',
      'Output format:',
      'Summary: <one sentence> | Risk: <Low/Medium/High>',
      '',
      JSON.stringify(payload),
    ].join('\n');

    const response = await model.generateContent(prompt);
    const text = response.response.text().trim();

    if (!text) {
      throw new Error('Gemini returned an empty summary');
    }

    return text;
  }
}

export const aiService = new AIService();
