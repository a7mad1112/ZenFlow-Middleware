# Endpoints Usage

Base URL: `http://localhost:3000`

## Health

### GET /health
Checks API + queue health.

## Core Webhook Routes

### POST /webhooks
Enqueue a webhook event (legacy route).

Body:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "user.created",
  "data": { "name": "Ali" },
  "userId": "user-1"
}
```

### GET /tasks/:id
Returns basic task details placeholder response.

## Pipeline Routes

### POST /api/pipelines
Create a pipeline.

Body:
```json
{
  "name": "Email Pipeline",
  "actionType": "EMAIL",
  "description": "Send email notifications"
}
```

### GET /api/pipelines
List pipelines.

### GET /api/pipelines/:id
Get one pipeline.

### PUT /api/pipelines/:id
Update a pipeline.

Body (partial):
```json
{
  "description": "Updated description"
}
```

### DELETE /api/pipelines/:id
Delete a pipeline.

## Pipeline Subscribers

### GET /api/pipelines/:id/subscribers
List subscribers for a pipeline.

### POST /api/pipelines/:id/subscribers
Add subscriber.

Body:
```json
{
  "targetUrl": "https://example.com/webhook"
}
```

## Pipeline Webhooks

### GET /api/pipelines/:id/webhooks
List webhooks linked to a pipeline.

### POST /api/pipelines/:id/webhooks
Create/link webhook to a pipeline.

Body:
```json
{
  "eventType": "order.created",
  "url": "https://example.com/events"
}
```

## Ingestion + Tracking

### POST /api/webhooks/:webhookId
Ingest payload for processing (supports webhook ID or pipeline ID in controller logic).

Body:
```json
{
  "orderId": "123",
  "amount": 250
}
```

Response includes `logId` and `jobId`.

### GET /api/webhooks/:webhookId/status/:logId
Check processing status/result for a queued job.
