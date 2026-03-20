# Discord Forwarder Pipeline Usage (From Scratch)

This guide walks you through a complete test flow:
1. Send JSON to the webhook endpoint.
2. Convert JSON to XML in Action 1.
3. Forward XML to Discord in Action 2.
4. Verify result in database and API status endpoint.

Base URL: `http://localhost:3000`

## 1. Prerequisites

1. Docker and Docker Compose are running.
2. App dependencies are installed.
3. Database is migrated.
4. `DISCORD_WEBHOOK_URL` is set in your environment.

Example `.env` values:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/webhook_db
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1484577996676399105/TIEjxf87BaiNBpMUOv-SomMZA7HoFYInfO_o-PKn7EWmP5hyBttafmqUpCsJlbHNs2V5
```

## 2. Start Services

Use either local Node or Docker.

### Option A: Local run

```bash
npm install
npm run db:migrate
npm run dev
```

### Option B: Docker Compose

```bash
docker compose up --build
```

## 3. Confirm Health

### GET /health

```bash
curl http://localhost:3000/health
```

Expected: queue connected and healthy response.

## 4. Create Converter Pipeline

Create a pipeline with `actionType: CONVERTER`.

### POST /api/pipelines

```bash
curl -X POST http://localhost:3000/api/pipelines \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Discord XML Pipeline",
    "description": "Convert JSON to XML and forward to Discord",
    "actionType": "CONVERTER"
  }'
```

Save `data.id` from response as `PIPELINE_ID`.

## 5. Create Webhook for Pipeline

### POST /api/pipelines/:id/webhooks

```bash
curl -X POST http://localhost:3000/api/pipelines/PIPELINE_ID/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "order.created",
    "url": "https://example.com/receiver"
  }'
```

Save `data.id` from response as `WEBHOOK_ID`.

## 6. Send Test JSON Payload

### POST /api/webhooks/:webhookId

```bash
curl -X POST http://localhost:3000/api/webhooks/WEBHOOK_ID \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD-1001",
    "customer": {
      "name": "Ali Alawneh",
      "email": "ali@example.com"
    },
    "items": [
      { "sku": "SKU-1", "qty": 2, "price": 25 },
      { "sku": "SKU-2", "qty": 1, "price": 40 }
    ],
    "total": 90,
    "currency": "USD"
  }'
```

Save `logId` from response.

## 7. Check Processing Status

### GET /api/webhooks/:webhookId/status/:logId

```bash
curl http://localhost:3000/api/webhooks/WEBHOOK_ID/status/LOG_ID
```

Expected when successful:
1. `status` is `completed` (or processed equivalent in your environment).
2. `result` contains XML.
3. `error` is null.

## 8. Verify Discord Message

In your Discord channel, confirm a new message appears with this structure:

````text
***New Pipeline Result***
```xml
<data>...</data>
```
````

The XML content should match what is stored in task `result`.

## 9. Postman-Friendly Quick Flow

If you are testing with Postman:
1. Create pipeline: `POST /api/pipelines`
2. Create webhook: `POST /api/pipelines/:id/webhooks`
3. Ingest payload: `POST /api/webhooks/:webhookId`
4. Poll status: `GET /api/webhooks/:webhookId/status/:logId`
5. Check Discord channel

## 10. Failure Behavior (Important)

If Discord forward fails (4xx/5xx):
1. XML conversion result is still preserved in `result`.
2. Task is marked failed.
3. Error details are stored in `error` and logs.

This helps you debug Discord issues without losing conversion output.
