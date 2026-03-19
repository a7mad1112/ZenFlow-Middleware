# PG-Boss Architecture & Initialization Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Express Application                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────┐        ┌─────────────────────────┐       │
│  │   API Layer          │        │   Worker Layer          │       │
│  │  (Producer)          │        │   (Consumer)            │       │
│  │                      │        │                         │       │
│  │ POST /webhooks       │        │ setupWorkers()          │       │
│  │ ↓                    │        │ ↓                       │       │
│  │ getQueue()           │        │ queue.work()            │       │
│  │ queue.publish()      │        │ processWebhookTask()    │       │
│  └──────────┬───────────┘        └────────────┬────────────┘       │
│             │                                 │                     │
│             └─────────────────┬────────────────┘                    │
│                               │                                     │
│  ┌────────────────────────────▼────────────────────────────┐       │
│  │       Queue Configuration Module (queue.ts)            │       │
│  │                                                         │       │
│  │  startQueue()      - Initialize queue on startup       │       │
│  │  getQueue()        - Retrieve active queue             │       │
│  │  stopQueue()       - Graceful shutdown                 │       │
│  │  healthCheckQueue() - Connectivity verification        │       │
│  │                                                         │       │
│  │  let pgBoss: PgBoss | null = null                      │       │
│  │  Singleton pattern ensures one instance                │       │
│  └────────────────────────┬───────────────────────────────┘       │
│                           │                                        │
└───────────────────────────┼────────────────────────────────────────┘
                            │
                            │ TCP Connection
                            │ (pg-boss protocol)
                            │
┌───────────────────────────▼────────────────────────────────────────┐
│                    PostgreSQL Database                              │
│                    (Docker container)                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  schema: pgboss                                                     │
│  ├── job              — Task records (status, payload, retries)     │
│  ├── subscription     — Queue subscriptions                        │
│  ├── archive          — Completed/failed jobs                      │
│  └── version          — Schema version metadata                    │
│                                                                     │
│  Other schemas:                                                     │
│  ├── public (Prisma models)                                        │
│  │   ├── pipelines                                                 │
│  │   ├── webhooks                                                  │
│  │   └── tasks                                                     │
│  └──────────────────────────────────                                │
│                         │                                           │
└─────────────────────────┼───────────────────────────────────────────┘
                          │
                          ▲
                          │
                    Health checks
                    Query job status
                    Monitor jobs
                    (via Prisma Studio)
```

---

## Initialization Sequence (Startup Flow)

```
main() called
  │
  ├─→ logger.info("Starting webhook task processor...")
  │
  ├─→ await startQueue()
  │     │
  │     ├─→ Check if pgBoss already running
  │     │
  │     ├─→ new PgBoss({ connectionString, max, schema: 'pgboss', ... })
  │     │     │
  │     │     └─→ PgBoss constructor validates connectionString
  │     │
  │     ├─→ pgBoss.on('error', (error) => logger.error(...))
  │     │     │
  │     │     └─→ Attach error event handler
  │     │
  │     ├─→ await pgBoss.start()
  │     │     │
  │     │     ├─→ Connect to PostgreSQL
  │     │     ├─→ CREATE SCHEMA IF NOT EXISTS pgboss
  │     │     ├─→ CREATE TABLE IF NOT EXISTS pgboss.job
  │     │     ├─→ CREATE TABLE IF NOT EXISTS pgboss.subscription
  │     │     ├─→ CREATE TABLE IF NOT EXISTS pgboss.archive
  │     │     ├─→ CREATE TABLE IF NOT EXISTS pgboss.version
  │     │     └─→ Start job polling/maintenance
  │     │
  │     └─→ logger.info("✅ PG-Boss queue started successfully", { ... })
  │
  ├─→ const pgBoss = getQueue()
  │     │
  │     └─→ Return the initialized pgBoss instance
  │
  ├─→ await setupWorkers(pgBoss)
  │     │
  │     ├─→ Create 5 worker instances (WORKER_CONCURRENCY=5)
  │     │     │
  │     │     └─→ For each worker:
  │     │         │
  │     │         └─→ pgBoss.work('process-webhook', { batchSize: 1 }, async (jobs) => {
  │     │               │
  │     │               └─→ for (const job of jobs) {
  │     │                     await processWebhookTask(job.data);
  │     │                   }
  │     │             })
  │     │
  │     └─→ logger.info("Workers registered successfully")
  │
  ├─→ app.listen(config.port, ...)
  │     │
  │     └─→ logger.info("🚀 Server listening on port 3000")
  │
  ├─→ process.on('SIGTERM', async () => { ... })
  │     │
  │     └─→ Graceful shutdown handler
  │
  ├─→ process.on('SIGINT', async () => { ... })
  │     │
  │     └─→ Graceful shutdown handler (Ctrl+C)
  │
  └─→ Application ready to receive webhooks
     └─→ POST /webhooks → publish job to queue
     └─→ Worker processes job from queue
     └─→ GET /health → verify queue connectivity
```

---

## Request/Response Flow

### 1. Webhook Ingestion (POST /webhooks)

```
Client Request
  │
  ├─→ POST /webhooks
  │   {
  │     "id": "550e8400-e29b-41d4-a716-446655440000",
  │     "eventType": "order.created",
  │     "data": {"orderId": "ORD-123"}
  │   }
  │
  ├─→ Express receives request
  │
  ├─→ setupRoutes callback
  │     │
  │     ├─→ Validate payload with Zod schema
  │     │
  │     ├─→ Create WebhookPayload with timestamp
  │     │
  │     ├─→ const queue = getQueue()
  │     │
  │     ├─→ const jobId = await queue.publish('process-webhook', webhook, {
  │     │       priority: 10,
  │     │       retryLimit: 2,
  │     │       retryDelay: 5,
  │     │     })
  │     │     │
  │     │     └─→ INSERT INTO pgboss.job VALUES (...)
  │     │
  │     ├─→ logger.info("Task enqueued successfully", ...)
  │     │
  │     └─→ res.status(202).json({
  │           success: true,
  │           job_id: '123'
  │         })
  │
  └─→ Client receives 202 Accepted
```

### 2. Background Job Processing (Queue → Worker)

```
PG-Boss Polling
  │
  ├─→ SELECT * FROM pgboss.job WHERE state = 'created'
  │
  ├─→ UPDATE pgboss.job SET state = 'active'
  │
  ├─→ Call registered worker
  │     │
  │     ├─→ setupWorkers callback invoked
  │     │
  │     ├─→ for (const job of jobs) {
  │     │     await processWebhookTask(job.data)
  │     │   }
  │     │
  │     ├─→ processWebhookTask()
  │     │     │
  │     │     ├─→ logger.info("Processing webhook task", ...)
  │     │     │
  │     │     ├─→ Simulate work (100ms delay)
  │     │     │
  │     │     ├─→ logger.info("Task completed successfully", ...)
  │     │     │
  │     │     └─→ Return TaskResult
  │     │
  │     └─→ PG-Boss receives completion
  │
  ├─→ UPDATE pgboss.job SET state = 'completed'
  │
  └─→ Optionally archive to pgboss.archive
     (after archiveCompletedAfterSeconds: 86400)
```

### 3. Health Check (GET /health)

```
Client Request
  │
  ├─→ GET /health
  │
  ├─→ Express route handler
  │     │
  │     ├─→ const queueHealthy = await healthCheckQueue()
  │     │     │
  │     │     ├─→ if (!pgBoss) return false
  │     │     │
  │     │     ├─→ await pgBoss.publish('__health_check__', { test: true }, ...)
  │     │     │
  │     │     └─→ return true (if successful)
  │     │
  │     └─→ res.status(queueHealthy ? 200 : 503).json({
  │           status: queueHealthy ? 'healthy' : 'degraded',
  │           queue: queueHealthy ? 'connected' : 'disconnected'
  │         })
  │
  └─→ Client receives health status
```

---

## Error Handling & Recovery

### Connection Errors

```
startQueue() fails
  │
  ├─→ Catch error
  │
  ├─→ logger.error("❌ Failed to initialize PG-Boss:", { ... })
  │
  ├─→ throw error
  │
  ├─→ main() catch block
  │     │
  │     ├─→ logger.error("Failed to start application:", { ... })
  │     │
  │     └─→ process.exit(1)
  │
  └─→ Container exits with failure
     (Docker restart policy can retry)
```

### Job Processing Errors

```
processWebhookTask() throws error
  │
  ├─→ Catch error
  │
  ├─→ logger.error("Task processing failed", { ... })
  │
  ├─→ Return TaskResult with error
  │
  ├─→ PG-Boss detects failure
  │
  ├─→ If attempts < retryLimit:
  │     ├─→ Delay retryDelay seconds
  │     ├─→ Re-enqueue job
  │     └─→ Worker picks up again
  │
  └─→ If attempts == retryLimit:
      ├─→ Mark job as failed
      └─→ Move to archive
```

### Graceful Shutdown

```
SIGTERM/SIGINT received
  │
  ├─→ logger.info("SIGTERM received, shutting down gracefully...")
  │
  ├─→ await stopQueue()
  │     │
  │     ├─→ if (!pgBoss) return
  │     │
  │     ├─→ await pgBoss.stop()
  │     │     │
  │     │     ├─→ Drain active jobs (wait for completion)
  │     │     └─→ Close PostgreSQL connection
  │     │
  │     ├─→ logger.info("✅ PG-Boss stopped gracefully")
  │     │
  │     └─→ pgBoss = null
  │
  ├─→ process.exit(0)
  │
  └─→ Application terminates cleanly
```

---

## Key Design Patterns

### 1. **Singleton Pattern** (Queue Instance)
```typescript
let pgBoss: PgBoss | null = null;

// Only one instance throughout application lifetime
// Safe access via getQueue()
```

### 2. **Lazy Initialization**
```typescript
// startQueue() creates instance only when called
// Allows configuration before initialization
```

### 3. **Graceful Degradation**
```typescript
// healthCheckQueue() returns boolean
// Health endpoint returns 503 when disconnected
// API can handle partial failures
```

### 4. **Error Propagation**
```typescript
// Errors thrown from startQueue()
// Caught in main() for proper shutdown
// Prevents orphaned connections
```

---

## Monitoring & Debugging

### View Active Jobs
```sql
SELECT id, name, state, attempts, created_on, started_on
FROM pgboss.job
WHERE state IN ('created', 'active', 'retry')
ORDER BY priority DESC, created_on;
```

### View Failed Jobs
```sql
SELECT id, name, error, attempts, created_on, started_on
FROM pgboss.job
WHERE state = 'failed'
ORDER BY created_on DESC;
```

### View Queue Statistics
```sql
SELECT 
  COUNT(*) as total_jobs,
  COUNT(CASE WHEN state = 'active' THEN 1 END) as active,
  COUNT(CASE WHEN state = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN state = 'failed' THEN 1 END) as failed
FROM pgboss.job;
```

### Real-time Logs
```bash
docker logs -f webhook_app

# Watch for:
# ✅ PG-Boss queue started successfully
# Workers registered successfully
# Webhook ingested
# Task enqueued successfully
# Processing webhook task
# Task completed successfully
```

---

## Configuration Parameters

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `max` (pgBossPoolSize) | 10 | Max concurrent database connections |
| `schema` | pgboss | PostgreSQL schema for queue tables |
| `archiveCompletedAfterSeconds` | 86400 (24h) | How long to keep completed jobs |
| `priority` (job) | (default) | Job priority for queue ordering |
| `retryLimit` (job) | (configurable) | Max retry attempts on failure |
| `retryDelay` (job) | (configurable) | Seconds to wait before retry |
| `batchSize` (worker) | 1 | Jobs processed per batch |

