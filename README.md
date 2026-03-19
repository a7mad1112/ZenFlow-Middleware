# Webhook-Driven Task Processing Pipeline

A production-ready TypeScript project skeleton for a webhook-driven task processing pipeline using Node.js, Express, PostgreSQL, and pg-boss.

## Features

- **TypeScript**: Strict mode enabled, modern ES modules
- **Express**: Minimal HTTP server for webhook ingestion
- **pg-boss**: Job queue for reliable task processing
- **PostgreSQL**: Persistent storage for tasks and state
- **Docker**: Multi-stage build for optimized production images
- **Linting & Formatting**: ESLint and Prettier pre-configured
- **Environment Management**: Zod-validated configuration

## Project Structure

```
src/
├── api/                 # HTTP API routes and controllers
│   └── routes.ts       # Webhook ingestion endpoints
├── worker/             # PG-Boss worker processes
│   └── taskHandler.ts  # Task processing logic
├── models/             # Domain types and schemas
│   └── types.ts        # Core type definitions
├── config/             # Configuration management
│   └── env.ts          # Environment variable validation
├── shared/             # Shared utilities
│   └── logger.ts       # Logging system
└── index.ts            # Application entry point
```

## Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Docker & Docker Compose (optional)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd webhook-task-processor
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

## Development

### Running Locally

```bash
# Start with ts-node-dev (auto-restart on file changes)
npm run dev
```

### Building

```bash
# TypeScript compilation
npm run build

# Run compiled code
npm start
```

### Code Quality

```bash
# Linting
npm run lint
npm run lint:fix

# Code formatting
npm run format
npm run format:check

# Type checking
npm run type-check
```

## Docker

### Build and Run

```bash
# Using docker-compose (includes PostgreSQL)
docker-compose up --build

# Production build
docker build -t webhook-processor .
docker run -p 3000:3000 webhook-processor
```

## API Endpoints

### Health Check
- `GET /health` - Returns service health status

### Webhook Ingestion
- `POST /webhooks` - Accept webhook events
  ```json
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "eventType": "order.created",
    "data": { "orderId": 12345 },
    "userId": "user@example.com"
  }
  ```

### Task Status
- `GET /tasks/:id` - Get task processing status

## Architecture

### API Layer (`src/api/`)
Handles incoming webhook requests, validates payloads, and enqueues tasks using pg-boss.

### Worker Layer (`src/worker/`)
Processes queued tasks asynchronously with configurable concurrency and timeout settings.

### Models Layer (`src/models/`)
Contains domain types and schemas for type safety across layers.

### Configuration (`src/config/`)
Centralizes environment variable management with Zod validation.

### Shared Utilities (`src/shared/`)
Provides logging, helpers, and other cross-cutting concerns.

## Configuration

See `.env.example` for all available configuration options:

- `NODE_ENV` - Environment (development/production/test)
- `PORT` - Express server port (default: 3000)
- `DATABASE_URL` - PostgreSQL connection string
- `WORKER_CONCURRENCY` - Number of parallel workers (default: 5)
- `TASK_TIMEOUT_MS` - Task execution timeout (default: 30000)

## Best Practices

- ✅ Strict TypeScript with comprehensive types
- ✅ ESLint + Prettier enforced
- ✅ Separation of concerns (API, Worker, Model layers)
- ✅ Environment-based configuration
- ✅ Structured logging
- ✅ Docker-ready with health checks
- ✅ Non-root user in container
- ✅ Proper signal handling

## Next Steps

1. **Database Schema**: Create tables for tasks, webhooks, and audit logs
2. **Error Handling**: Implement retry logic and dead-letter queues
3. **Monitoring**: Add metrics and distributed tracing
4. **Testing**: Set up Jest/Vitest for unit and integration tests
5. **Authentication**: Implement webhook signature verification
6. **Rate Limiting**: Add request rate limiting middleware

## License

MIT
