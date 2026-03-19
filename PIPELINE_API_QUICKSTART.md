# Pipeline API - Quick Start Guide

## Setup

### 1. Start the Application

```bash
npm run dev
```

Expected output:
```
✅ PG-Boss queue started successfully
Workers registered successfully
🚀 Server listening on port 3000
```

### 2. Verify API is Running

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "queue": "connected",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

---

## Quick API Tests

### Test 1: Create a Pipeline

```bash
curl -X POST http://localhost:3000/api/pipelines \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Email Pipeline",
    "description": "Sends emails to subscribers",
    "actionType": "EMAIL",
    "config": {
      "provider": "sendgrid"
    }
  }'
```

**Expected Response (201):**
```json
{
  "success": true,
  "message": "Pipeline created successfully",
  "data": {
    "id": "clif9k5zk000109ls9s8s8s0l",
    "name": "Email Pipeline",
    "description": "Sends emails to subscribers",
    "actionType": "EMAIL",
    "config": { "provider": "sendgrid" },
    "isActive": true,
    "createdAt": "2024-01-15T10:30:45.000Z",
    "updatedAt": "2024-01-15T10:30:45.000Z"
  }
}
```

**Save the ID for use in other tests!**

---

### Test 2: List All Pipelines

```bash
curl http://localhost:3000/api/pipelines
```

**Expected Response (200):**
```json
{
  "success": true,
  "message": "Retrieved 1 pipeline(s)",
  "data": [
    {
      "id": "clif9k5zk000109ls9s8s8s0l",
      "name": "Email Pipeline",
      "description": "Sends emails to subscribers",
      "actionType": "EMAIL",
      "config": { "provider": "sendgrid" },
      "isActive": true,
      "createdAt": "2024-01-15T10:30:45.000Z",
      "updatedAt": "2024-01-15T10:30:45.000Z",
      "subscribers": []
    }
  ]
}
```

---

### Test 3: Get Pipeline by ID

```bash
# Replace clif9k5zk000109ls9s8s8s0l with your pipeline ID
curl http://localhost:3000/api/pipelines/clif9k5zk000109ls9s8s8s0l
```

**Expected Response (200):**
```json
{
  "success": true,
  "message": "Pipeline retrieved successfully",
  "data": {
    "id": "clif9k5zk000109ls9s8s8s0l",
    "name": "Email Pipeline",
    "description": "Sends emails to subscribers",
    "actionType": "EMAIL",
    "config": { "provider": "sendgrid" },
    "isActive": true,
    "createdAt": "2024-01-15T10:30:45.000Z",
    "updatedAt": "2024-01-15T10:30:45.000Z",
    "subscribers": []
  }
}
```

---

### Test 4: Add a Subscriber

```bash
# Replace clif9k5zk000109ls9s8s8s0l with your pipeline ID
curl -X POST http://localhost:3000/api/pipelines/clif9k5zk000109ls9s8s8s0l/subscribers \
  -H "Content-Type: application/json" \
  -d '{
    "targetUrl": "https://webhook.example.com/email"
  }'
```

**Expected Response (201):**
```json
{
  "success": true,
  "message": "Subscriber added successfully",
  "data": {
    "id": "clif9k5zk000209ls9s8s8s0m",
    "pipelineId": "clif9k5zk000109ls9s8s8s0l",
    "targetUrl": "https://webhook.example.com/email",
    "isActive": true,
    "createdAt": "2024-01-15T10:35:00.000Z",
    "updatedAt": "2024-01-15T10:35:00.000Z"
  }
}
```

---

### Test 5: Get All Subscribers for a Pipeline

```bash
# Replace clif9k5zk000109ls9s8s8s0l with your pipeline ID
curl http://localhost:3000/api/pipelines/clif9k5zk000109ls9s8s8s0l/subscribers
```

**Expected Response (200):**
```json
{
  "success": true,
  "message": "Retrieved 1 subscriber(s)",
  "data": [
    {
      "id": "clif9k5zk000209ls9s8s8s0m",
      "targetUrl": "https://webhook.example.com/email",
      "isActive": true,
      "createdAt": "2024-01-15T10:35:00.000Z",
      "updatedAt": "2024-01-15T10:35:00.000Z"
    }
  ]
}
```

---

### Test 6: Add Another Subscriber

```bash
# Replace clif9k5zk000109ls9s8s8s0l with your pipeline ID
curl -X POST http://localhost:3000/api/pipelines/clif9k5zk000109ls9s8s8s0l/subscribers \
  -H "Content-Type: application/json" \
  -d '{
    "targetUrl": "https://backup.example.com/notifications"
  }'
```

---

### Test 7: Update Pipeline

```bash
# Replace clif9k5zk000109ls9s8s8s0l with your pipeline ID
curl -X PUT http://localhost:3000/api/pipelines/clif9k5zk000109ls9s8s8s0l \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated description",
    "config": {
      "provider": "sendgrid",
      "region": "us-east-1"
    }
  }'
```

**Expected Response (200):**
```json
{
  "success": true,
  "message": "Pipeline updated successfully",
  "data": {
    "id": "clif9k5zk000109ls9s8s8s0l",
    "name": "Email Pipeline",
    "description": "Updated description",
    "actionType": "EMAIL",
    "config": {
      "provider": "sendgrid",
      "region": "us-east-1"
    },
    "isActive": true,
    "createdAt": "2024-01-15T10:30:45.000Z",
    "updatedAt": "2024-01-15T10:40:00.000Z"
  }
}
```

---

### Test 8: Delete Pipeline

```bash
# Replace clif9k5zk000109ls9s8s8s0l with your pipeline ID
curl -X DELETE http://localhost:3000/api/pipelines/clif9k5zk000109ls9s8s8s0l
```

**Expected Response (200):**
```json
{
  "success": true,
  "message": "Pipeline deleted successfully"
}
```

---

## Validation Examples

### Invalid ActionType (400 Error)

```bash
curl -X POST http://localhost:3000/api/pipelines \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Pipeline",
    "actionType": "INVALID_TYPE"
  }'
```

**Response:**
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "code": "invalid_enum_value",
      "expected": "'CONVERTER' | 'EMAIL' | 'DISCORD' | 'PDF' | 'AI_SUMMARIZER'",
      "received": "'INVALID_TYPE'",
      "path": ["actionType"],
      "message": "Invalid actionType"
    }
  ]
}
```

### Invalid URL (400 Error)

```bash
curl -X POST http://localhost:3000/api/pipelines/clif9k5zk000109ls9s8s8s0l/subscribers \
  -H "Content-Type: application/json" \
  -d '{
    "targetUrl": "not-a-valid-url"
  }'
```

**Response:**
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "code": "invalid_string",
      "validation": "url",
      "path": ["targetUrl"],
      "message": "targetUrl must be a valid URL"
    }
  ]
}
```

### Duplicate Pipeline Name (409 Error)

```bash
# Try to create pipeline with same name
curl -X POST http://localhost:3000/api/pipelines \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Email Pipeline",
    "actionType": "EMAIL"
  }'
```

**Response:**
```json
{
  "success": false,
  "message": "Pipeline with this name already exists"
}
```

### Pipeline Not Found (404 Error)

```bash
curl http://localhost:3000/api/pipelines/invalid-id-that-doesnt-exist
```

**Response:**
```json
{
  "success": false,
  "message": "Pipeline not found"
}
```

---

## Using Postman/Insomnia

### Import as cURL

You can copy any of the curl commands above and paste them in Postman's "Import" → "Raw text" feature.

### Manual Setup

1. **Create new request**: `POST`
2. **URL**: `http://localhost:3000/api/pipelines`
3. **Headers**:
   ```
   Content-Type: application/json
   ```
4. **Body** (raw JSON):
   ```json
   {
     "name": "Test Pipeline",
     "actionType": "EMAIL",
     "description": "Test"
   }
   ```
5. **Send** → See response

---

## ActionType Options

| Value | Description |
|-------|-------------|
| `CONVERTER` | Transform/convert data |
| `EMAIL` | Send email notifications |
| `DISCORD` | Send Discord messages |
| `PDF` | Generate PDF documents |
| `AI_SUMMARIZER` | AI-powered summarization |

---

## Database Verification

### Check Pipelines Table

```bash
npm run db:studio

# Navigate to: public → pipelines table
```

### Direct SQL Query

```bash
psql postgresql://postgres:postgres@localhost:5432/webhook_processor

# List all pipelines
SELECT * FROM pipelines;

# List all subscribers
SELECT * FROM subscribers;

# Check pipeline with subscribers
SELECT p.id, p.name, p.actionType, s.targetUrl
FROM pipelines p
LEFT JOIN subscribers s ON p.id = s.pipelineId
ORDER BY p.createdAt DESC;
```

---

## Error Handling Summary

| Scenario | Status | Message |
|----------|--------|---------|
| Valid request | 200/201 | Success message |
| Invalid field | 400 | "Validation error" with details |
| Resource not found | 404 | "Pipeline not found" |
| Duplicate name | 409 | "Pipeline with this name already exists" |
| Server error | 500 | "Internal server error" |

---

## Tips

1. **Save Pipeline IDs** — Use them for subscriber operations
2. **Test Validation** — Try invalid ActionTypes to see validation in action
3. **Monitor Logs** — Watch `npm run dev` output for database operations
4. **Use Prisma Studio** — `npm run db:studio` to visualize data
5. **Check Status Codes** — Different codes indicate different outcomes

---

## Next Steps

Once you verify the API:
1. Integrate with your frontend
2. Add authentication/authorization
3. Implement subscriber callback handling
4. Set up monitoring and alerts
5. Deploy to production

See `API_DOCUMENTATION.md` for complete endpoint reference.
