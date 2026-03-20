# Dashboard Feature Specification

## Executive Summary
The Dashboard is the control center for Monitoring and Management of the webhook-driven automation platform. It will let product, operations, and engineering teams configure pipelines, monitor job execution health, inspect action outputs, and react to failures quickly. The design direction is a clean, professional dark interface inspired by modern SaaS control planes.

## Proposed Tech Stack
- Frontend Framework: React + Vite
- Styling System: TailwindCSS with Dark Mode first
- Routing: React Router
- Form Management: Formik + Yup
- API Client: Axios

## Current Backend Capabilities (From Code Analysis)

### API Layer
- Pipeline CRUD is implemented.
- Subscriber management per pipeline is implemented.
- Webhook registration per pipeline is implemented.
- Webhook ingestion endpoint creates queue tasks and returns tracking identifiers.
- Task status endpoint returns detailed execution record.
- Legacy webhook route and placeholder legacy task route exist.

### Worker Layer
- Queue worker processes tasks from task queue and updates task states.
- Action 1 implemented: JSON to XML conversion and persistence.
- Action 2 implemented: Discord notifier with optional skip logic.
- Action 3 implemented: Email notifier with HTML template and optional PDF attachment.
- Action 4 implemented: PDF invoice generation with byte-size logging.
- Action 5 implemented: Gemini AI summarization with fraud/risk heuristics and fallback summary.
- AI summary is injected into both Discord and Email notifications.

### Data Model (Prisma)
- Core entities: Pipeline, Webhook, Task, Subscriber.
- Pipeline supports action toggles via enabledActions and flags (discordEnabled, emailEnabled).
- Task stores lifecycle fields: status, attempts, error, payload, result, completedAt.

## Feature List (Detailed)

### 1. Pipeline Management
- Create, read, update, and delete pipelines.
- Display pipeline metadata: name, actionType, active status, created date.
- Show related counts: webhooks, subscribers, recent task volume.
- Provide edit modal/page for pipeline description and action settings.

### 2. Action Configuration (5 Actions)
Support configuration and toggling for:
- XML Converter
- Discord Notifier
- Email Notifier
- PDF Generator
- AI Summarizer

UI requirements:
- Toggle switches per action with clear enabled/disabled state.
- Per-action config panel (webhook URL status, SMTP readiness, Gemini key status, etc.).
- Validation hints before enabling action chains.

### 3. Conditional Routing UI
- Pipeline-level controls for action gating (discordEnabled, emailEnabled, enabledActions).
- Request-level rule presets for metadata flags:
  - skipDiscord
  - skipEmail (new planned support)
  - future flags for AI/PDF routing
- Rule preview showing expected execution path before save.

### 4. Live Monitoring
- Real-time or near-real-time table of webhook tasks.
- Columns:
  - Task ID
  - Pipeline
  - Webhook/Event Type
  - Status (pending, processing, completed, failed)
  - Attempts
  - AI Risk (parsed from AI summary)
  - Updated At
- Filters:
  - status
  - pipeline
  - risk level
  - date range
- Auto-refresh with manual refresh control.

### 5. Execution Details (Drill-down)
Per-task detail panel/page:
- Request payload viewer (formatted JSON)
- Generated XML result
- AI summary and risk rationale
- PDF metadata (generated yes/no, size in bytes)
- Notification outcomes:
  - Email sent/skipped/failed
  - Discord sent/skipped/failed
- Error logs and retry history

## API Endpoints Needed

### Existing Endpoints (Available)
- GET /health
- POST /api/pipelines
- GET /api/pipelines
- GET /api/pipelines/:id
- PUT /api/pipelines/:id
- DELETE /api/pipelines/:id
- GET /api/pipelines/:id/subscribers
- POST /api/pipelines/:id/subscribers
- GET /api/pipelines/:id/webhooks
- POST /api/pipelines/:id/webhooks
- POST /api/webhooks/:webhookId
- GET /api/webhooks/:webhookId/status/:logId
- POST /webhooks (legacy)
- GET /tasks/:id (legacy placeholder)

### New Endpoints (Required for Dashboard)
- GET /api/stats
Purpose: KPI cards and aggregate counters.
Response candidates:
- totalTasks
- successRate
- failedTasks
- pendingTasks
- averageProcessingTime
- riskDistribution (Low/Medium/High)

- GET /api/logs
Purpose: paginated monitoring feed.
Query params:
- page, limit, status, pipelineId, risk, from, to, search

- GET /api/logs/:id
Purpose: drill-down execution detail.

- PATCH /api/pipelines/:id
Purpose: partial updates for dashboard toggles and action config.

- PATCH /api/pipelines/:id/actions
Purpose: explicit action toggle/config endpoint.
Body example:
- enabledActions
- discordEnabled
- emailEnabled
- future pdfEnabled/aiEnabled

- POST /api/tasks/:id/retry
Purpose: retry failed tasks from dashboard.

- GET /api/pipelines/:id/health
Purpose: readiness checks for configured actions on a pipeline.

## User Scenarios and Edge Cases
- Disable Email for high-risk orders while keeping Discord notifications enabled.
- Retry a failed PDF generation and resend the email attachment.
- Skip Discord for specific incoming requests via metadata while pipeline-level Discord remains enabled.
- AI provider rate limit occurs: fallback summary is used and pipeline continues.
- SMTP failure: job completes core processing but records email channel failure.
- Discord webhook misconfiguration: task marks channel error while retaining XML result.
- Sandbox requests (VOID/TEST/DUMMY order IDs) should be visible as low-risk non-sale events.

## Docker Integration Plan (Frontend)

### Service Additions
Add a frontend service in docker-compose:
- service name: dashboard
- build context: ./dashboard (new frontend app directory)
- depends_on: app
- environment:
  - VITE_API_BASE_URL=http://localhost:3000
- ports:
  - 5173:5173 (dev) or 8080:80 (production nginx)

### Vite-Optimized Dockerfile (Frontend)
- Multi-stage build:
  - Stage 1: node image builds Vite assets
  - Stage 2: nginx image serves static dist output
- Include caching strategy for package manager lockfile and node_modules layers.

### Network/Proxy Notes
- Prefer reverse proxy path routing in production:
  - /api -> backend app
  - / -> dashboard static app
- Keep CORS simple in local dev with explicit allowed origin for dashboard host.

## UI/UX Direction: Clean Professional Dark Mode
- Visual style: minimal, high-contrast dark interface (Vercel/Stripe-inspired).
- Typography: neutral sans-serif with clear hierarchy.
- Panels: subtle borders, low-noise shadows, strong spacing rhythm.
- Status semantics:
  - Success: green accents
  - Warning: amber accents
  - Failure: red accents
  - Pending/Processing: blue/cyan accents
- Data-first layout:
  - sticky filters
  - table virtualization readiness
  - compact but readable detail drawers
- Accessibility:
  - WCAG-compliant contrast
  - keyboard navigability
  - visible focus states

## Delivery Phases
1. Dashboard Foundation
- scaffold React + Vite + Tailwind + Router + Axios
- auth placeholder and layout shell

2. Pipeline Management Screens
- list/create/edit/delete pipelines
- action toggle controls

3. Monitoring Screens
- task table, filters, and live refresh
- basic detail drawer

4. Deep Observability
- detailed job timeline
- retry actions
- risk analytics cards

5. Production Hardening
- loading/error skeleton states
- e2e test coverage
- Docker production deployment and proxy wiring
