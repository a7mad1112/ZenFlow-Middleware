import { z } from 'zod';

const envSchema = z.object({
  nodeEnv: z
    .enum(['development', 'production', 'test'])
    .default('development')
    .transform((val) => val || process.env.NODE_ENV || 'development'),
  port: z.coerce.number().default(3000),
  logLevel: z
    .enum(['error', 'warn', 'info', 'debug'])
    .default('info'),
  databaseUrl: z.string().url(),
  pgBossPoolSize: z.coerce.number().default(10),
  pgBossNewJobCheckInterval: z.coerce.number().default(1000),
  workerConcurrency: z.coerce.number().default(5),
  taskTimeoutMs: z.coerce.number().default(30000),
  discordWebhookUrl: z.preprocess(
    (value) => {
      if (typeof value === 'string' && value.trim() === '') {
        return undefined;
      }
      return value;
    },
    z.string().url().optional()
  ),
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const env = {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    logLevel: process.env.LOG_LEVEL,
    databaseUrl: process.env.DATABASE_URL,
    pgBossPoolSize: process.env.PG_BOSS_POOL_SIZE,
    pgBossNewJobCheckInterval: process.env.PG_BOSS_NEW_JOB_CHECK_INTERVAL,
    workerConcurrency: process.env.WORKER_CONCURRENCY,
    taskTimeoutMs: process.env.TASK_TIMEOUT_MS,
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
  };

  return envSchema.parse(env);
}

export const config: Config = loadConfig();
