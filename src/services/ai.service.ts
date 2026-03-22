import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env.js';

class AIService {
  private client: GoogleGenerativeAI | null = null;

  private readonly opsAssistantSystemPrompt = [
    'You are the ZenFlow Ops Assistant. Use the provided log context to answer user questions. Be concise and technical.',
    'Output must be valid Markdown and highly scannable.',
    'Formatting rules:',
    '1) Use exactly these section headers in order: ### 🔍 Analysis, ### 📊 System Stats, ### 💡 Recommendation.',
    '2) Any list of pipelines or task counts MUST be rendered as a Markdown table.',
    '3) Use status icons consistently: 🟢 for Success, 🔴 for Failure, 🟡 for Pending, ⚠️ for Risk.',
    '4) Use bold ONLY for the most important values (IDs, error messages, counts).',
    '5) Never output raw JSON unless explicitly requested by the user.',
    'Health-specific rules:',
    '6) If the user asks about health/system health, compute and report Health Score out of 100 using provided stats.',
    '7) Include Health Score as: Health Score: **X/100**.',
    'Failure-specific rules:',
    '8) If there is a failed task with an error, include the specific error inside a Markdown blockquote.',
    '9) If no error is available, state that explicitly in one sentence.',
    '10) Avoid decorative fluff; keep it operational and actionable.',
  ].join(' ');

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
        'You are a business and security assistant for e-commerce order triage. Analyze the JSON order and provide a skeptical but concise assessment. Apply these required security heuristics: (1) Small Amount Scams/Carding: if total is between 0.01 and 1.00, set risk to Medium and mention Potential Card Testing. (2) High-Value Orders: if total is above 5000, set risk to High and require VIP Verification. (3) Anonymous Data: if customer name is Unknown, Test, or Admin, or email looks fake like test@test.com, set risk to High. (4) Logical Inconsistency: if orderId contains VOID, TEST, or DUMMY, treat as Developer Sandbox Request and set risk to Low while stating it is not a real sale. (5) Bulk Orders: if item count is high while total is disproportionately low, flag Price Tampering Check and elevate risk appropriately. Always output exactly in this format: Summary: [Concise human-friendly summary] | Risk: [Low/Medium/High] | Reason: [Briefly explain why you chose this risk level].',
    });

    const prompt = [
      'Analyze this order payload and apply the required heuristics.',
      'Output format:',
      'Summary: <one sentence> | Risk: <Low/Medium/High> | Reason: <brief explanation>',
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

  async answerOpsQuestion(params: { question: string; context: unknown }): Promise<string> {
    const model = this.getClient().getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: this.opsAssistantSystemPrompt,
    });

    const prompt = [
      'Context JSON:',
      JSON.stringify(params.context, null, 2),
      '',
      'User question:',
      params.question,
      '',
      'Answer with concrete observations from the context and strictly follow the formatting rules.',
    ].join('\n');

    const response = await model.generateContent(prompt);
    const text = response.response.text().trim();

    if (!text) {
      throw new Error('Gemini returned an empty chat response');
    }

    return text;
  }
}

export const aiService = new AIService();
