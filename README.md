# ZenFlow Ops

**High-Performance AI-Driven Webhook Orchestrator**

[![CI](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-22-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Overview

ZenFlow Ops is a production-ready webhook orchestration platform that transforms incoming events into intelligent, multi-channel outputs. The system follows an **Inbound -> Queue -> Process -> Outbound** architecture that ensures reliability, scalability, and observability.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐     ┌──────────────┐
│   Inbound   │────▶│    Queue    │────▶│      Process        │────▶│   Outbound   │
│  (Webhook)  │     │  (pg-boss)  │     │  (Worker Engine)    │     │ (Subscribers)│
└─────────────┘     └─────────────┘     └─────────────────────┘     └──────────────┘
      │                   │                       │                        │
  Rate Limited      PostgreSQL           5 Processing Actions        HTTP Delivery
  Event Routing     Persistence          XML/AI/PDF/Email/Discord    Audit Logging
```

### Why Asynchronous over Synchronous?

| Aspect | Synchronous API | ZenFlow Ops (Async) |
|--------|-----------------|---------------------|
| **Response Time** | Blocked until all actions complete | Immediate acknowledgment with task ID |
| **Failure Isolation** | Single failure breaks entire request | Individual action failures are isolated and retryable |
| **Scalability** | Limited by request timeout | Workers scale independently of API layer |
| **Reliability** | Lost requests on server restart | Persistent queue survives restarts |
| **Observability** | Limited to request logs | Full execution timeline with drill-down |

---

## Architecture & Design Decisions

### PostgreSQL + pg-boss: Redis-Free Job Queuing

We chose **pg-boss** over Redis-based solutions for several key reasons:

- **Single Database Dependency**: PostgreSQL handles both application data and job queuing, reducing operational complexity
- **ACID Guarantees**: Jobs are transactionally safe with the same guarantees as your application data
- **No Data Loss**: Jobs persist through restarts without Redis AOF/RDB configuration concerns
- **Simplified Deployment**: One fewer service to manage, monitor, and secure

### Worker-Engine Pattern

The decoupled Worker-Engine architecture separates concerns:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Worker Engine                            │
├─────────┬─────────┬─────────┬─────────┬─────────┬──────────────┤
│   XML   │   AI    │   PDF   │  Email  │ Discord │  Dispatcher  │
│Converter│Summarizer│Generator│ Sender  │ Sender  │  (Outbound)  │
└─────────┴─────────┴─────────┴─────────┴─────────┴──────────────┘
```

- **Independent Action Execution**: Each action runs in isolation with its own error handling
- **Atomic Retries**: Only failed actions are retried, preventing duplicate API calls and token waste
- **Pipeline-Level Gating**: Actions can be enabled/disabled per pipeline
- **Request-Level Overrides**: Metadata flags (`skipEmail`, `skipDiscord`, etc.) provide granular control

### Prisma Schema

| Entity | Description | Key Fields |
|--------|-------------|------------|
| **Pipeline** | Webhook processing configuration | `name`, `enabledActions[]`, `rateLimit`, `emailEnabled`, `discordEnabled` |
| **Webhook** | Event-type routing rules | `eventType`, `url`, `isActive`, `pipelineId` |
| **Task** | Individual job execution record | `status`, `payload`, `result`, `attempts`, `maxAttempts`, `error` |
| **Subscriber** | Outbound delivery targets | `targetUrl`, `isActive`, `pipelineId` |
| **DeliveryLog** | Outbound delivery audit trail | `statusCode`, `responseBody`, `durationMs` |

**Relationships:**
- Pipeline (1) -> (N) Webhooks
- Pipeline (1) -> (N) Tasks
- Pipeline (1) -> (N) Subscribers
- Subscriber (1) -> (N) DeliveryLogs

---

## Core Features

### 5 Processing Actions

| Action | Description | Output |
|--------|-------------|--------|
| **XML Converter** | Transforms JSON payload into structured XML | `result.xml` attachment |
| **AI Summarizer** | Gemini 2.5 Flash analyzes orders for fraud/risk | Risk level + insights |
| **PDF Generator** | Creates professional invoice documents | `invoice.pdf` attachment |
| **Email Notifier** | Sends HTML confirmation emails via SMTP | Customer notification |
| **Discord Notifier** | Posts to Discord channels with file attachments | Team alerts |

### Reliability & Error Handling

- **Exponential Backoff**: Retry delays escalate (10s -> 20s -> 40s -> 1m -> 2m)
- **Atomic Retries**: Previously successful actions are skipped on retry
- **Stuck Task Lifecycle**: Tasks exhausting all retries are marked `stuck` for manual intervention
- **Manual Re-queue**: Dashboard retry button resets attempt counter for operator recovery
- **Channel Isolation**: Email/Discord failures don't fail the core task

### AI-Powered Fraud Detection

The Gemini AI Summarizer includes advanced heuristics:
- Card-testing pattern detection
- VIP customer verification thresholds
- Anonymous/fake identity checks
- Sandbox order identification (VOID/TEST/DUMMY)
- Price tampering analysis

---

## Stretch Goals & Polish

### AI Ops-Assistant (RAG Chat)

A floating chat widget powered by Gemini 2.5 Flash provides natural language operations support:
- Queries real-time execution data via RAG (Retrieval-Augmented Generation)
- Quick actions: "Why did my last task fail?", "System Health?"
- Computes health scores and surfaces failure patterns
- Markdown-formatted responses with tables and status icons

### Rate Limiting

Pipeline-scoped request throttling protects against webhook flooding:
- Configurable per-pipeline rate limits (default: 60 req/min)
- In-memory cache reduces database lookups
- Custom 429 response with `retryAfter` header

### Interactive Swagger UI

Full OpenAPI 3.0 documentation at `/api-docs`:
- Try-it-out functionality for all endpoints
- Request/response schema documentation
- Rate limit annotations

### Dashboard UI

Modern React + Vite + TailwindCSS control plane:
- Pipeline management with action toggles
- Live monitoring table with filtering
- Execution drill-down with timeline visualization
- Visual analytics (Recharts pie/bar charts)
- Manual task triggering
- Destructive action confirmation modals

---

## CI/CD Pipeline

The GitHub Actions workflow implements a **3-tier parallel architecture** for faster feedback:

```yaml
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Linting   │     │  Backend Tests  │     │  Dashboard Tests │
│  (ESLint)   │     │ (Jest/Supertest)│     │ (Jest/RTL/jsdom) │
└─────────────┘     └─────────────────┘     └──────────────────┘
       ↓                    ↓                        ↓
    ~30 sec              ~60 sec                  ~45 sec
```

- **Node.js 22** across all jobs
- **npm ci** for reproducible builds
- **Parallel execution** reduces CI time by ~50%

---

## Setup & Installation

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16+ (or use Docker)

### Quick Start (Docker)

```bash
# Clone the repository
git clone <repository-url>
cd webhook

# Configure environment variables
cp .env.example .env
# Edit .env with your credentials (see below)

# Start all services
docker-compose up --build

# Access the applications
# Backend API: http://localhost:3000
# Dashboard:   http://localhost:5173
# Swagger UI:  http://localhost:3000/api-docs
```

### Environment Variables

Create a `.env` file with the following:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/webhook_processor

# Server
NODE_ENV=development
PORT=3000

# Worker
WORKER_CONCURRENCY=5

# Discord (Optional)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Email/SMTP (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yourapp.com

# AI (Optional)
GEMINI_API_KEY=your-gemini-api-key

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Local Development

```bash
# Install dependencies
npm install
cd dashboard && npm install && cd ..

# Run database migrations
npx prisma migrate dev

# Start backend (with hot reload)
npm run dev

# Start dashboard (separate terminal)
cd dashboard && npm run dev
```

---

## API Documentation

Interactive documentation available at: **[http://localhost:3000/api-docs](http://localhost:3000/api-docs)**

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/webhooks/:pipelineId` | Ingest webhook event (rate limited) |
| `GET` | `/api/pipelines` | List all pipelines |
| `POST` | `/api/pipelines` | Create new pipeline |
| `GET` | `/api/pipelines/:id` | Get pipeline details |
| `PUT` | `/api/pipelines/:id` | Update pipeline |
| `DELETE` | `/api/pipelines/:id` | Delete pipeline |
| `PATCH` | `/api/pipelines/:id/actions` | Toggle pipeline actions |
| `POST` | `/api/pipelines/:id/trigger` | Manual task dispatch |
| `GET` | `/api/pipelines/:id/subscribers` | List subscribers |
| `POST` | `/api/pipelines/:id/subscribers` | Add subscriber |
| `DELETE` | `/api/pipelines/:id/subscribers/:subscriberId` | Remove subscriber |
| `GET` | `/api/stats` | Dashboard statistics |
| `GET` | `/api/logs` | Paginated task logs |
| `GET` | `/api/logs/:id` | Task execution details |
| `POST` | `/api/tasks/:id/retry` | Retry failed task |
| `POST` | `/api/ai/chat` | AI Ops-Assistant query |
| `GET` | `/health` | Health check |

### Example: Webhook Ingestion

```bash
curl -X POST http://localhost:3000/api/webhooks/YOUR_PIPELINE_ID \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "order.created",
    "orderId": "ORD-12345",
    "customer": {
      "name": "John Doe",
      "email": "john@example.com"
    },
    "total": 99.99
  }'
```

Response:
```json
{
  "success": true,
  "taskId": "clx1234567890",
  "message": "Webhook received and queued"
}
```

---

## Project Structure

```
webhook/
├── src/
│   ├── api/
│   │   ├── controllers/     # Request handlers
│   │   └── routes/          # Express route definitions
│   ├── config/              # Environment configuration
│   ├── docs/                # Swagger/OpenAPI setup
│   ├── middleware/          # Rate limiting, CORS
│   ├── services/            # Business logic (AI, Email, PDF, Discord)
│   ├── shared/              # Utilities and logging
│   ├── worker/              # pg-boss worker engine
│   └── index.ts             # Application entry point
├── dashboard/               # React frontend
│   ├── src/
│   │   ├── api/             # Axios client
│   │   ├── components/      # UI components
│   │   ├── pages/           # Route pages
│   │   └── services/        # API service layer
│   └── Dockerfile           # Multi-stage production build
├── prisma/
│   └── schema.prisma        # Database schema
├── docker-compose.yml       # Container orchestration
└── .github/workflows/ci.yml # CI/CD pipeline
```

---

## Testing

```bash
# Backend tests
npm test

# Dashboard tests
cd dashboard && npm test

# Lint check
npm run lint

# Type check
npm run type-check
```

---

## License

MIT

---

Built with TypeScript, Express, PostgreSQL, pg-boss, Prisma, React, and Gemini AI.
