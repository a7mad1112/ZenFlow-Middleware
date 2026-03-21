import { type Express, type Request, type Response } from 'express';
import { z } from 'zod';
import { buildAssistantSnapshot } from '../../services/ai-assistant.service.js';
import { aiService } from '../../services/ai.service.js';
import { logger } from '../../shared/logger.js';

const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

export function setupAiRoutes(app: Express): void {
  app.post('/api/ai/chat', async (req: Request, res: Response): Promise<void> => {
    try {
      const { message } = chatRequestSchema.parse(req.body);
      const context = await buildAssistantSnapshot();

      const answer = await aiService.answerOpsQuestion({
        question: message,
        context,
      });

      res.status(200).json({
        success: true,
        data: {
          answer,
          contextGeneratedAt: context.generatedAt,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Invalid request payload',
          errors: error.errors,
        });
        return;
      }

      logger.error('POST /api/ai/chat failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        success: false,
        message: 'Failed to generate AI response',
      });
    }
  });
}
