import { PrismaClient } from '@prisma/client';
import rateLimit, { ipKeyGenerator, type RateLimitRequestHandler } from 'express-rate-limit';

const prisma = new PrismaClient();

const DEFAULT_RATE_LIMIT = 60;
const MIN_RATE_LIMIT = 1;
const MAX_RATE_LIMIT = 1000;
const CACHE_TTL_MS = 5 * 60 * 1000;

type RateLimitCacheEntry = {
  limit: number;
  expiresAt: number;
};

const rateLimitCache = new Map<string, RateLimitCacheEntry>();

function normalizeRateLimit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_RATE_LIMIT;
  }

  const rounded = Math.floor(value);
  if (rounded < MIN_RATE_LIMIT || rounded > MAX_RATE_LIMIT) {
    return DEFAULT_RATE_LIMIT;
  }

  return rounded;
}

async function getPipelineRateLimit(pipelineId: string): Promise<number> {
  const now = Date.now();
  const cached = rateLimitCache.get(pipelineId);
  if (cached && cached.expiresAt > now) {
    return cached.limit;
  }

  try {
    const pipeline = await prisma.pipeline.findUnique({
      where: { id: pipelineId },
      select: { rateLimit: true },
    });

    const limit = normalizeRateLimit(pipeline?.rateLimit);
    rateLimitCache.set(pipelineId, {
      limit,
      expiresAt: now + CACHE_TTL_MS,
    });
    return limit;
  } catch {
    return DEFAULT_RATE_LIMIT;
  }
}

/**
 * Limits inbound ingestion traffic to 60 req/minute per pipeline id.
 * Falls back to requester IP when pipeline id param is unavailable.
 */
export const webhookIngestionRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000,
  limit: async (req) => {
    const pipelineId = req.params?.pipelineId;
    if (typeof pipelineId !== 'string' || pipelineId.trim() === '') {
      return DEFAULT_RATE_LIMIT;
    }

    return getPipelineRateLimit(pipelineId.trim());
  },
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  keyGenerator: (req) => {
    const pipelineId = req.params?.pipelineId;
    if (typeof pipelineId === 'string' && pipelineId.trim() !== '') {
      return `pipeline:${pipelineId.trim().toLowerCase()}`;
    }

    return ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? 'unknown');
  },
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too many requests, please try again later.',
      retryAfter: '60s',
    });
  },
});
