# PG-Boss Queue Configuration Guide

## Overview

PG-Boss is configured as a background task queue using your existing PostgreSQL database. It automatically creates internal tables in the `pgboss` schema on first run and manages job lifecycle without external dependencies.

## Architecture

```
Producer (API)                 Queue (PG-Boss)              Consumer (Workers)
   ↓                               ↓                            ↓
POST /webhooks          →   Enqueue in pgboss        →   Worker processes job
(Job published)             (Queue tables)               (Task completed)
```

## Configuration Files

### [src/config/queue.ts](src/config/queue.ts)

Core queue initialization module with three main exports:

**`startQueue(): Promise<PgBoss>`**
- Initializes and starts the PG-Boss instance
- Creates pgboss schema and tables automatically
- Called once at application startup
- Idempotent: safe to call multiple times

**`getQueue(): PgBoss`**
- Returns the active queue instance
- Throws error if queue not initialized
- Used by producers and consumers

**`stopQueue(): Promise<void>`**
- Graceful shutdown of the queue
- Called on SIGTERM/SIGINT signals

**`healthCheckQueue(): Promise<boolean>`**
- Verifies queue connectivity
- Used by `/health` endpoint

### Configuration Parameters

From `.env`:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/webhook_processor
PG_BOSS_POOL_SIZE=10              # Connection pool size
PG_BOSS_NEW_JOB_CHECK_INTERVAL=1000  # Job polling interval (ms)
```

## Queue Schema

PG-Boss creates the following tables in the `pgboss` schema:

- `job` — Main job records table
- `subscription` — Event subscriptions
- `archive` — Completed/failed jobs (optional)
- `version` — Schema version tracking

## Usage Examples

### Producer (Enqueue Tasks)

```typescript
import { getQueue } from './config/queue.js';

const queue = getQueue();

// Simple job
await queue.publish('process-webhook', {
  id: 'webhook-123',
  eventType: 'order.created',
  data: { orderId: 'ORD-456' },
});

// With options
const jobId = await queue.publish('process-webhook', webhookPayload, {
  priority: 10,        // Higher number = higher priority
  retryLimit: 2,       // Max retry attempts
  retryDelay: 5,       // Seconds between retries
  expireInSeconds: 300, // Job expiration time
});

console.log(`Job enqueued: ${jobId}`);
```

### Consumer (Process Tasks)

```typescript
import { getQueue } from './config/queue.js';

const queue = getQueue();

// Register worker
queue.work('process-webhook', { batchSize: 1 }, async (jobs) => {
  for (const job of jobs) {
    try {
      await processWebhook(job.data);
      console.log(`Job ${job.id} completed`);
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      throw error; // PG-Boss will retry
    }
  }
});
```

### Current Implementation

The application uses this setup:

1. **Producer** — [src/api/routes.ts](src/api/routes.ts)
   - Receives webhooks via `POST /webhooks`
   - Publishes to `process-webhook` queue
   - Returns `202 Accepted` with job ID

2. **Consumer** — [src/worker/taskHandler.ts](src/worker/taskHandler.ts)
   - Listens on `process-webhook` queue
   - Processes 5 concurrent tasks (configurable)
   - Logs results

## Startup Flow

1. Application starts → calls `startQueue()`
2. PG-Boss connects to PostgreSQL
3. Creates `pgboss` schema if needed
4. Initializes internal tables
5. Workers register on queues
6. Express server starts
7. Ready to receive webhooks

## Logs Example

```
Starting webhook task processor...
✅ PG-Boss queue started successfully
  schema: pgboss
  poolSize: 10
  database: webhook_processor
Workers registered successfully
🚀 Server listening on port 3000
```

## Health Check

```bash
curl http://localhost:3000/health
```

Response when healthy:

```json
{
  "status": "healthy",
  "queue": "connected",
  "timestamp": "2026-03-19T10:30:45.123Z"
}
```

Response when degraded:

```json
{
  "status": "degraded",
  "queue": "disconnected",
  "timestamp": "2026-03-19T10:30:45.123Z"
}
```

## Graceful Shutdown

The application handles termination signals:

- `SIGTERM` — Docker stop, orchestration shutdown
- `SIGINT` — Ctrl+C, manual termination

Shutdown sequence:
1. Log shutdown signal
2. Stop accepting new jobs
3. Wait for in-flight jobs to complete
4. Close database connections
5. Exit with code 0

## Monitoring with Prisma Studio

View queue data in PostgreSQL:

```bash
npm run db:studio
```

Navigate to the `pgboss` schema to see:
- Active jobs
- Job history
- Error logs
- Subscription records

## Troubleshooting

### Connection Refused

```error
connect ECONNREFUSED 127.0.0.1:5432
```

**Fix:** Ensure PostgreSQL is running in Docker:

```bash
docker-compose up -d postgres
```

### Schema Already Exists

PG-Boss handles this gracefully. Safe to restart.

### Jobs Not Processing

1. Check logs: `docker logs webhook_app`
2. Verify workers started: Look for "Workers registered successfully"
3. Check queue health: `curl localhost:3000/health`
4. View jobs in Prisma Studio under pgboss schema

## Production Considerations

### Connection Pool

Increase `PG_BOSS_POOL_SIZE` for high throughput:

```bash
PG_BOSS_POOL_SIZE=50  # For production
```

### Job Retention

Configure archive retention in [src/config/queue.ts](src/config/queue.ts):

```typescript
archiveCompletedAfterSeconds: 604800, // 7 days
```

### Error Handling

PG-Boss retries failed jobs based on `retryLimit`. Jobs that exceed retries go to archives.

### Worker Scaling

Run multiple worker instances:

```bash
npm run build
node dist/index.js &
node dist/index.js &
node dist/index.js &
```

All share the same PostgreSQL queue automatically.

## Testing Queue

### Manual Job

```bash
curl -X POST http://localhost:3000/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "eventType": "order.created",
    "data": { "orderId": "ORD-123" }
  }'
```

Response:

```json
{
  "success": true,
  "message": "Webhook accepted for processing",
  "webhook_id": "550e8400-e29b-41d4-a716-446655440000",
  "job_id": "123"
}
```

Check logs for job processing → "Task completed successfully" message.
