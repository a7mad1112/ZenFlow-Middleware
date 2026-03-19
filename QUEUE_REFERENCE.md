# PG-Boss Queue - Quick Reference

## Core Exports from `src/config/queue.ts`

### `startQueue(): Promise<PgBoss>`
Initializes the PG-Boss queue on application startup. Creates `pgboss` schema and internal tables.

**Usage:**
```typescript
import { startQueue } from './config/queue.js';

await startQueue();
// Queue is now ready for publishing and working
```

### `getQueue(): PgBoss`
Returns the active queue instance. Throws if queue not initialized.

**Usage:**
```typescript
import { getQueue } from './config/queue.js';

const queue = getQueue();
await queue.publish('task-name', { data });
```

### `stopQueue(): Promise<void>`
Gracefully stops the queue. Automatically registered on SIGTERM/SIGINT.

**Usage:**
```typescript
import { stopQueue } from './config/queue.js';

await stopQueue();
```

### `healthCheckQueue(): Promise<boolean>`
Verifies queue connectivity for health checks.

**Usage:**
```typescript
import { healthCheckQueue } from './config/queue.js';

const isHealthy = await healthCheckQueue();
```

---

## Application Points of Integration

### 1. Entry Point: `src/index.ts`
- Imports: `startQueue`, `stopQueue`, `healthCheckQueue`, `getQueue`
- Calls `startQueue()` during initialization
- Registers graceful shutdown handlers
- `/health` endpoint uses `healthCheckQueue()`

### 2. Producer: `src/api/routes.ts`
- **Endpoint:** `POST /webhooks`
- Uses `getQueue()` to publish jobs to `process-webhook` queue
- Returns `202 Accepted` with job ID
- Configuration:
  - `priority: 10` — Medium priority
  - `retryLimit: 2` — Retry up to 2 times
  - `retryDelay: 5` — Wait 5 seconds between retries

### 3. Consumer: `src/worker/taskHandler.ts`
- Registers workers on `process-webhook` queue
- Processes webhook payloads
- Configured for 5 concurrent jobs (configurable via `WORKER_CONCURRENCY`)

---

## PG-Boss Configuration

**Schema:** `pgboss` (automatically created in PostgreSQL)

**Tables Created:**
- `job` — Job records
- `subscription` — Event subscriptions
- `archive` — Completed/failed jobs
- `version` — Schema metadata

**Environment Variables:**
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/webhook_processor
PG_BOSS_POOL_SIZE=10              # Connection pool
PG_BOSS_NEW_JOB_CHECK_INTERVAL=1000  # (for reference in config/env.ts)
```

**Job Retention:**
- Completed jobs archived after 24 hours (configurable)
- Failed jobs kept indefinitely (visible in archive)

---

## Testing the Queue

### 1. Enqueue a Webhook

```bash
curl -X POST http://localhost:3000/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "eventType": "order.created",
    "data": { "orderId": "ORD-123" }
  }'
```

### 2. Check Health

```bash
curl http://localhost:3000/health
```

### 3. View Queue Data

```bash
npm run db:studio  # Open Prisma Studio
# Navigate to pgboss schema → job table
```

### 4. View Logs

```bash
# Watch for:
# ✅ PG-Boss queue started successfully
# Workers registered successfully
# Task enqueued successfully
# Task completed successfully
```

---

## Error Scenarios

| Scenario | Error | Fix |
|----------|-------|-----|
| PostgreSQL not running | `connect ECONNREFUSED` | `docker-compose up -d postgres` |
| Wrong connection string | `invalid database URL` | Check `DATABASE_URL` in `.env` |
| Queue not initialized | `PG-Boss queue not initialized` | Ensure `startQueue()` was called |
| Worker crash | Job retries indefinitely | Check logs, fix handler error |

---

## Production Deployment

### Scaling Workers

Run multiple instances (all share same queue):

```bash
npm run build
node dist/index.js &
node dist/index.js &
node dist/index.js &
```

### Increasing Pool Size

```bash
PG_BOSS_POOL_SIZE=50
```

### Monitoring

- **Health endpoint:** Track connectivity
- **Logs:** Stream to centralized logging (ELK, DataDog, etc.)
- **Database:** Query `pgboss.job` table directly for metrics
- **Metrics:** Count active/completed/failed jobs

---

## Advanced Usage

### Custom Job Options

```typescript
const jobId = await queue.publish('process-webhook', payload, {
  priority: 10,           // 1-100, higher = more urgent
  retryLimit: 3,          // Max retries on failure
  retryDelay: 10,         // Seconds between retries
  startAfter: Date.now() + 60000, // Delay 60 seconds
  expireInSeconds: 300,   // Job expires in 300 seconds
  singletonKey: 'unique-id', // Prevents duplicates
});
```

### Batch Processing

```typescript
queue.work('process-webhook', { batchSize: 10 }, async (jobs) => {
  // Process 10 jobs at a time
  await Promise.all(jobs.map(job => processWebhook(job.data)));
});
```

### Event Listeners

```typescript
const queue = getQueue();

queue.on('job:start', (data) => console.log('Job started:', data.id));
queue.on('job:complete', (data) => console.log('Job completed:', data.id));
queue.on('job:failed', (data) => console.log('Job failed:', data.id));
```

---

## Logs Example

```
Starting webhook task processor...
  node_env: development
  port: 3000
✅ PG-Boss queue started successfully
  schema: pgboss
  poolSize: 10
  database: webhook_processor
Workers registered successfully
🚀 Server listening on port 3000
Webhook ingested
  webhook_id: 550e8400-e29b-41d4-a716-446655440000
  event_type: order.created
Task enqueued successfully
  webhook_id: 550e8400-e29b-41d4-a716-446655440000
  job_id: 123
Processing webhook task
  webhook_id: 550e8400-e29b-41d4-a716-446655440000
  event_type: order.created
Task completed successfully
  webhook_id: 550e8400-e29b-41d4-a716-446655440000
```

---

## Files Modified/Created

✅ **Created:**
- `src/config/queue.ts` — Queue initialization module
- `QUEUE_SETUP.md` — Comprehensive documentation
- `QUEUE_REFERENCE.md` — This quick reference

✅ **Updated:**
- `src/index.ts` — Added queue initialization and graceful shutdown
- `src/api/routes.ts` — Implemented job publishing
- `package.json` — Already had pg-boss as dependency

✅ **Configuration:**
- `.env` — Already has `DATABASE_URL` and PG_BOSS settings
- `docker-compose.yml` — Already configured with PostgreSQL
