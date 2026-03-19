# Pipeline & Subscriber REST API Documentation

## Overview

This RESTful API provides complete CRUD operations for managing Pipelines and Subscribers. Built with Express.js, Prisma ORM, and Zod validation.

## Base URL

```
http://localhost:3000/api
```

## Features

✅ Full CRUD operations for Pipelines  
✅ Add and list Subscribers per Pipeline  
✅ Zod validation for request bodies  
✅ Proper HTTP status codes  
✅ Comprehensive error handling  
✅ ActionType enum validation (CONVERTER, EMAIL, DISCORD, PDF, AI_SUMMARIZER)  
✅ URL validation for target URLs  

---

## Pipelines Endpoints

### 1. Create Pipeline

**Endpoint:** `POST /api/pipelines`

**Description:** Create a new pipeline with an action type and optional configuration.

**Request Body:**
```json
{
  "name": "Email Notification Pipeline",
  "description": "Sends emails to subscribers",
  "actionType": "EMAIL",
  "config": {
    "subject": "New Notification",
    "template": "notification"
  }
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Unique pipeline name (1-255 characters) |
| description | string | No | Optional description |
| actionType | string | Yes | One of: CONVERTER, EMAIL, DISCORD, PDF, AI_SUMMARIZER |
| config | object | No | JSON configuration object for the action |

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Pipeline created successfully",
  "data": {
    "id": "clin2k5zk000109la8g8g8g0l",
    "name": "Email Notification Pipeline",
    "description": "Sends emails to subscribers",
    "actionType": "EMAIL",
    "config": {
      "subject": "New Notification",
      "template": "notification"
    },
    "isActive": true,
    "createdAt": "2024-01-15T10:30:45.000Z",
    "updatedAt": "2024-01-15T10:30:45.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` — Validation error (invalid actionType, missing required fields)
- `409 Conflict` — Pipeline name already exists
- `500 Internal Server Error` — Server error

---

### 2. List All Pipelines

**Endpoint:** `GET /api/pipelines`

**Description:** Retrieve all pipelines with their subscribers.

**Query Parameters:** None

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Retrieved 2 pipeline(s)",
  "data": [
    {
      "id": "clin2k5zk000109la8g8g8g0l",
      "name": "Email Notification Pipeline",
      "description": "Sends emails to subscribers",
      "actionType": "EMAIL",
      "config": { "subject": "New Notification" },
      "isActive": true,
      "createdAt": "2024-01-15T10:30:45.000Z",
      "updatedAt": "2024-01-15T10:30:45.000Z",
      "subscribers": [
        {
          "id": "cliq1l5zk000209lg5h9h9h1m",
          "targetUrl": "https://api.example.com/notify",
          "isActive": true,
          "createdAt": "2024-01-15T10:35:00.000Z"
        }
      ]
    }
  ]
}
```

---

### 3. Get Pipeline by ID

**Endpoint:** `GET /api/pipelines/:id`

**Description:** Retrieve a specific pipeline with its subscribers.

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Pipeline ID (CUID format) |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Pipeline retrieved successfully",
  "data": {
    "id": "clin2k5zk000109la8g8g8g0l",
    "name": "Email Notification Pipeline",
    "description": "Sends emails to subscribers",
    "actionType": "EMAIL",
    "config": { "subject": "New Notification" },
    "isActive": true,
    "createdAt": "2024-01-15T10:30:45.000Z",
    "updatedAt": "2024-01-15T10:30:45.000Z",
    "subscribers": [
      {
        "id": "cliq1l5zk000209lg5h9h9h1m",
        "targetUrl": "https://api.example.com/notify",
        "isActive": true,
        "createdAt": "2024-01-15T10:35:00.000Z"
      }
    ]
  }
}
```

**Error Responses:**
- `404 Not Found` — Pipeline not found
- `500 Internal Server Error` — Server error

---

### 4. Update Pipeline

**Endpoint:** `PUT /api/pipelines/:id`

**Description:** Update an existing pipeline (all fields optional).

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Pipeline ID |

**Request Body (all fields optional):**
```json
{
  "name": "Updated Pipeline Name",
  "description": "Updated description",
  "actionType": "DISCORD",
  "config": { "channel": "notifications" }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Pipeline updated successfully",
  "data": {
    "id": "clin2k5zk000109la8g8g8g0l",
    "name": "Updated Pipeline Name",
    "description": "Updated description",
    "actionType": "DISCORD",
    "config": { "channel": "notifications" },
    "isActive": true,
    "createdAt": "2024-01-15T10:30:45.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` — Validation error
- `404 Not Found` — Pipeline not found
- `409 Conflict` — Name already exists
- `500 Internal Server Error` — Server error

---

### 5. Delete Pipeline

**Endpoint:** `DELETE /api/pipelines/:id`

**Description:** Delete a pipeline and all its associated subscribers.

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Pipeline ID |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Pipeline deleted successfully"
}
```

**Error Responses:**
- `404 Not Found` — Pipeline not found
- `500 Internal Server Error` — Server error

---

## Subscribers Endpoints

### 6. List Pipeline Subscribers

**Endpoint:** `GET /api/pipelines/:id/subscribers`

**Description:** Get all subscribers for a specific pipeline.

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Pipeline ID |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Retrieved 3 subscriber(s)",
  "data": [
    {
      "id": "cliq1l5zk000209lg5h9h9h1m",
      "targetUrl": "https://api.example.com/notify",
      "isActive": true,
      "createdAt": "2024-01-15T10:35:00.000Z",
      "updatedAt": "2024-01-15T10:35:00.000Z"
    },
    {
      "id": "cliq2l5zk000309lh6i0i0i2n",
      "targetUrl": "https://webhook.example.com/events",
      "isActive": true,
      "createdAt": "2024-01-15T10:40:00.000Z",
      "updatedAt": "2024-01-15T10:40:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `404 Not Found` — Pipeline not found
- `500 Internal Server Error` — Server error

---

### 7. Add Subscriber to Pipeline

**Endpoint:** `POST /api/pipelines/:id/subscribers`

**Description:** Add a subscriber (webhook target) to a pipeline.

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Pipeline ID |

**Request Body:**
```json
{
  "targetUrl": "https://api.example.com/webhooks/notify"
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| targetUrl | string | Yes | Valid URL to send notifications to |

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Subscriber added successfully",
  "data": {
    "id": "cliq3l5zk000409lj7j1j1j3o",
    "pipelineId": "clin2k5zk000109la8g8g8g0l",
    "targetUrl": "https://api.example.com/webhooks/notify",
    "isActive": true,
    "createdAt": "2024-01-15T10:45:00.000Z",
    "updatedAt": "2024-01-15T10:45:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` — Invalid URL format
- `404 Not Found` — Pipeline not found
- `500 Internal Server Error` — Server error

---

## Validation Rules

### ActionType Enum
Valid values: `CONVERTER`, `EMAIL`, `DISCORD`, `PDF`, `AI_SUMMARIZER`

**Example:**
```bash
curl -X POST http://localhost:3000/api/pipelines \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Pipeline",
    "actionType": "EMAIL"
  }'
```

### Pipeline Name
- Required, unique
- 1-255 characters

### Target URL
- Must be valid URL format
- Examples: `https://example.com`, `http://localhost:3000/webhook`

**Invalid:**
- `not-a-url`
- `ftp://example.com` (only HTTP/HTTPS)
- Empty string

---

## Error Handling

### Common Error Responses

**Validation Error (400):**
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "code": "invalid_enum_value",
      "expected": "'CONVERTER' | 'EMAIL' | 'DISCORD' | 'PDF' | 'AI_SUMMARIZER'",
      "received": "'INVALID'",
      "path": ["actionType"],
      "message": "Invalid actionType"
    }
  ]
}
```

**Not Found (404):**
```json
{
  "success": false,
  "message": "Pipeline not found"
}
```

**Conflict Error (409):**
```json
{
  "success": false,
  "message": "Pipeline with this name already exists"
}
```

**Server Error (500):**
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## Example Workflows

### 1. Create a Pipeline and Add Subscribers

```bash
# Step 1: Create pipeline
curl -X POST http://localhost:3000/api/pipelines \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Email Campaign",
    "description": "Send marketing emails",
    "actionType": "EMAIL",
    "config": {
      "from": "noreply@example.com",
      "replyTo": "support@example.com"
    }
  }'

# Response includes: { "data": { "id": "pipeline-123", ... } }

# Step 2: Add first subscriber
curl -X POST http://localhost:3000/api/pipelines/pipeline-123/subscribers \
  -H "Content-Type: application/json" \
  -d '{
    "targetUrl": "https://email-service.example.com/send"
  }'

# Step 3: Add second subscriber
curl -X POST http://localhost:3000/api/pipelines/pipeline-123/subscribers \
  -H "Content-Type: application/json" \
  -d '{
    "targetUrl": "https://backup.example.com/email"
  }'

# Step 4: Verify pipeline and subscribers
curl http://localhost:3000/api/pipelines/pipeline-123
```

### 2. Update a Pipeline

```bash
curl -X PUT http://localhost:3000/api/pipelines/pipeline-123 \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated campaign description",
    "config": {
      "from": "campaigns@example.com",
      "replyTo": "support@example.com"
    }
  }'
```

### 3. List All Pipelines

```bash
curl http://localhost:3000/api/pipelines
```

---

## Response Status Codes

| Status | Meaning |
|--------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Validation error |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Duplicate resource |
| 500 | Internal Server Error - Server error |

---

## Implementation Details

### Technology Stack
- **Framework:** Express.js with TypeScript
- **Database:** PostgreSQL (Prisma ORM)
- **Validation:** Zod
- **Logging:** Winston (via logger module)

### Files
- `src/api/routes/pipeline.routes.ts` — Route handlers
- `src/api/controllers/pipeline.controller.ts` — Business logic
- `src/index.ts` — Main application setup

### Database Models
- **Pipeline:** Main pipeline record with actionType and config
- **Subscriber:** Webhook targets for a pipeline

---

## Testing

### Create Pipeline Test
```bash
curl -X POST http://localhost:3000/api/pipelines \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Pipeline",
    "actionType": "CONVERTER",
    "description": "Test pipeline"
  }'
```

### Get All Pipelines Test
```bash
curl http://localhost:3000/api/pipelines
```

### Add Subscriber Test
```bash
# Replace pipeline-id with actual ID from create response
curl -X POST http://localhost:3000/api/pipelines/[pipeline-id]/subscribers \
  -H "Content-Type: application/json" \
  -d '{
    "targetUrl": "https://example.com/webhook"
  }'
```

---

## Notes

- All timestamps are in UTC ISO format
- IDs are CUID format (collision-resistant unique identifiers)
- Config field accepts any JSON object
- Subscribers are cascade-deleted when pipeline is deleted
- Pipeline names must be unique
- All endpoints require `Content-Type: application/json` header for POST/PUT requests
