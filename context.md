# Project Context (Single Source of Truth)

## Current Status
- Platform Stage: Intelligent Operations Platform
- Delivery State: Feature-complete for current scope
- Product Readiness: 100% of dashboard.md requirements implemented
- Primary Capability: End-to-end webhook automation with AI-assisted operations diagnostics (RAG chat over live system context)

## Current Progress

### 1. Ingestion API (Webhooks / Pipelines)
- Pipeline management endpoints are implemented (create, list, update, delete).
- Webhook registration and ingestion endpoints are implemented.
- Incoming webhook payloads are accepted, validated, and tracked with task/log identifiers.

### 2. Background Processing (Worker Engine + pg-boss)
- Jobs are enqueued through pg-boss and consumed by worker engine instances.
- Worker lifecycle handles processing, success, and failure status updates in the database.
- Retry behavior now uses resilient reliability controls with per-task max-attempt policies and action-aware retries.

### 3. Action 1: XML Converter
- JSON payload is sanitized and transformed into XML.
- XML output is stored in the task result field for traceability.

### 4. Action 2: Discord Notifier
- Converter results can be forwarded to Discord via webhook.
- Discord delivery is resilient and no longer hard-depends on XML generation.
- If XML exists, Discord sends XML as an attachment; if XML is disabled/missing, Discord sends a text-only summary fallback.
- If no XML and no summary content are available, Discord is safely skipped (no POST call) with explicit skipped metadata.
- Request-level override is supported via `metadata.skipDiscord`.

### 5. Action 3: Email Notifier (Gmail / Nodemailer)
- Nodemailer service is implemented as an exportable singleton (`emailService`).
- Order confirmation email template is HTML-based and includes a summary table:
  - Order ID
  - Customer Name
  - Total Amount
- Email trigger runs after conversion when `payload.customer.email` is present.
- Email now supports optional PDF attachment (`invoice.pdf`) from the PDF service.
- SMTP/env failures are logged without crashing worker execution flow.

### 6. Smart Routing (Conditional Action Logic)
- Pipeline-level action gating is in place for Discord (with schema-level direction for feature flags/arrays).
- Request-level metadata can selectively skip actions (currently Discord override is implemented).
- Skip decisions are logged with explicit reason messages.

### 7. Action 4: PDF Generator
- PDFKit-based invoice generation is implemented in the service layer.
- Invoice includes:
  - Header: INVOICE
  - Order ID and generated date
  - Customer name and total amount in a clean summary layout
- Worker integration is active after XML conversion.
- Current behavior logs generation success and size: `PDF generated (size: X bytes)`.
- PDF-to-Email integration is complete: generated invoice is attached to customer confirmation emails.
- If PDF generation fails, system logs warning and sends email without attachment.

### 8. Action 5: AI Summarizer (Gemini 2.5 Flash)
- Gemini service layer is implemented with API-key based initialization.
- Worker generates an AI order summary at the start of pipeline processing.
- AI output is propagated to both notification channels:
  - Discord message starts with AI insight.
  - Email body starts with AI insight.
- On AI errors (rate limits or API failure), worker falls back to `New Order Received` without stopping pipeline execution.
- Advanced Fraud and Heuristic Analysis is implemented in the Gemini system instruction, including card-testing detection, VIP verification thresholds, anonymous/fake identity checks, sandbox order identification, and price tampering checks.

### 9. Dashboard Blueprint (Completed and Delivered)
- The full specification in `dashboard.md` has been fully implemented.
- Delivered scope includes pipeline management, action configuration, conditional routing UI, live monitoring, execution drill-down, required API expansion, Docker frontend integration, and dark-mode design system.

### 10. Dashboard Support APIs (Complete)
- Implemented `GET /api/stats` for total tasks, success rate, grouped status counts, and AI risk distribution.
- Implemented `GET /api/logs` with pagination and filtering by status, pipelineId, and riskLevel.
- Implemented `GET /api/logs/:id` returning full task detail including payload and action outputs (XML, AI summary, PDF/email/discord execution metadata when available).
- Worker task result payload is now persisted as structured execution details to support dashboard drill-down views.

### 11. Dashboard Frontend Foundation (Initialized)
- The `dashboard/` frontend is now TypeScript-based (React + Vite) with initial routing and a dark-mode-first shell.
- TailwindCSS, PostCSS, and Autoprefixer are configured with class-based dark mode.
- Core frontend dependencies were added: Axios, React Router, Lucide icons, clsx, and tailwind-merge.
- Frontend structure was scaffolded for API layer, layout components, UI primitives, and pages.
- Implemented Axios client at `dashboard/src/api/client.ts` using `import.meta.env.VITE_API_BASE_URL`.
- Added initial dashboard UI with sidebar + navbar and a Stats Overview page that fetches data from `GET /api/stats`.

### 12. Dashboard Dockerization (Complete)
- Frontend containerization is production-ready using a multi-stage Docker build:
  - Build stage: Node compiles the Vite app.
  - Runtime stage: Nginx serves static assets with SPA fallback.
- Docker Compose integration is complete with the dashboard service connected to backend APIs.
- Frontend routing works in container runtime via Nginx `try_files` SPA strategy.

### 13. Backend CORS Support (Dashboard Integration)
- Added Express CORS middleware in `src/index.ts` with origin validation against configured allowlist.
- Added `cors` dependency and `@types/cors` for TypeScript support.
- Extended environment config (`src/config/env.ts`) with `CORS_ORIGINS` parsing (comma-separated list), defaulting to localhost dashboard origins.
- Updated Docker Compose backend environment to include `CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`.
- Verified API response headers now include `Access-Control-Allow-Origin: http://localhost:5173` for dashboard-origin requests.

### 14. Dashboard Stats Parsing Hardening
- Fixed dashboard stats client parsing to support backend response envelope shape (`{ success, data }`) returned by `GET /api/stats`.
- Added normalization/defaults in `dashboard/src/api/stats.service.ts` to prevent runtime crashes from missing nested fields (`statusCounts`, `riskDistribution`).
- Resolved frontend runtime error: `Cannot read properties of undefined (reading 'failed')` in dashboard stats rendering.

### 15. Interactive Logs Monitoring Table (Dashboard)
- Implemented frontend logs API integration in `dashboard/src/services/logs.service.ts` with:
  - `getLogs(params)` for `GET /api/logs`
  - `getLogById(id)` for `GET /api/logs/:id`
  - response normalization for status and risk fields.
- Replaced logs page scaffold with an interactive monitoring table in `dashboard/src/pages/logs-page.tsx`:
  - professional dark Tailwind table for live logs
  - status badges (success/failed/pending color mapping)
  - risk badges based on AI risk level.
- Added side drawer detail view on row click:
  - fetches full log details by ID
  - renders formatted JSON payload
  - renders action timeline (XML Created -> AI Analyzed -> PDF Generated -> Email Sent)
  - shows AI summary and PDF status summary.
- Added live update behavior with 5-second polling plus manual Refresh button for near-real-time monitoring.

### 16. Log Drawer Data Mapping Correction
- Extracted drawer into dedicated component `dashboard/src/components/logs/LogDetailDrawer.tsx` for clearer integration boundaries.
- Fixed detail mapping to support both backend result formats:
  - legacy string result (raw XML)
  - structured result object (`xml`, `aiSummary`, `pdf`, `email`, `discord`).
- Updated timeline visualization logic:
  - for `status=completed`, core actions (`XML Created`, `AI Analyzed`, `Discord Sent`) are shown as `Success`.
  - PDF and Email steps derive status from actual `result` fields and error/skipped metadata.
- Improved AI analysis rendering by formatting `aiSummary` strings cleanly and parsing risk from AI text when explicit `riskLevel` is absent.
- Risk badge in the drawer header now uses derived risk (API riskLevel fallback + AI summary parsing) to avoid unnecessary `Unknown` labels.

### 17. Log Detail API Result Normalization
- Updated backend dashboard controller to normalize `result` in both logs list and logs detail responses.
- `GET /api/logs/:id` now always returns a JSON `result` object with stable keys:
  - `xml`
  - `aiSummary`
  - `pdfInfo` (`generated`, `sizeBytes`, `path`, `error`)
  - `raw` (original stored payload for traceability)
- Frontend drawer now maps `pdfInfo` and displays failed-task errors in a red alert card.

### 18. Frontend Contract Alignment (aiSummary, riskLevel, actions)
- Updated `dashboard/src/services/logs.service.ts` types to consume structured controller fields directly:
  - `riskLevel` as concrete `Low | Medium | High`
  - `aiSummary` as top-level log field
  - `actions` map (`xml`, `ai`, `discord`, `pdf`, `email`) for timeline rendering.
- Logs table now uses controller `riskLevel` directly in badge text/color mapping (removed `Unknown` fallback label).
- Log detail drawer now uses:
  - `log.aiSummary` for AI Analysis text
  - `log.actions` for timeline step statuses
  - explicit red alert card when `log.status === 'failed'` and `log.error` exists.
- Added safe compatibility normalization so older records still render, while new structured controller fields drive primary UI state.

### 19. Pipeline Management UI (Feature 1 & 2)
- Added dashboard pipeline service `dashboard/src/services/pipelines.service.ts` with CRUD and action toggle methods:
  - `getPipelines`, `createPipeline`, `updatePipeline`, `deletePipeline`, `toggleAction`.
- Implemented action toggles for all 5 actions in `dashboard/src/pages/pipelines-page.tsx`:
  - XML (`CONVERTER`), Discord, Email, PDF, AI.
  - Toggle updates are persisted through backend pipeline update endpoint and reflected immediately via refresh.
- Implemented Pipeline list UI with dark-mode cards showing:
  - Name, ID, active status, description, updated timestamp.
- Implemented create pipeline modal form using Formik + Yup with fields:
  - `name`, `description`, `actionType`.
- Added pipeline delete action in UI and refresh-based synchronization after create/update/delete/toggle operations.
- Added backend `PATCH /api/pipelines/:id` route alias (same behavior as PUT update) to support dashboard toggle integration semantics.

### 20. Manual Retry and Error Recovery UX
- Added backend endpoint `POST /api/tasks/:id/retry` in `src/api/routes/dashboard.routes.ts`.
- Implemented retry logic in `src/api/controllers/webhook.controller.ts`:
  - loads original task payload and metadata
  - re-enqueues job in pg-boss `task-queue`
  - resets task status to `pending` and clears task error/completed timestamp.
- Added `retryTask(id)` API helper in `dashboard/src/services/logs.service.ts`.
- Updated `dashboard/src/components/logs/LogDetailDrawer.tsx` with:
  - prominent retry button for failed tasks
  - loading spinner while retry is in progress
  - success/error notification message after retry attempts
  - copy task ID button for operations/debugging
  - refresh hooks to reload log status/details after successful retry.

### 21. Dashboard Visual Analytics (Recharts)
- Installed `recharts` in `dashboard` frontend.
- Enhanced `dashboard/src/pages/dashboard-page.tsx` with transformed stats datasets for chart rendering:
  - `statusCounts` -> status pie chart data (`{ name, value }`)
  - `riskDistribution` -> risk bar chart data (`{ name, value }`).
- Added `StatusChart` as a responsive `PieChart` with semantic colors and dark-themed tooltip/legend.
- Added `RiskAnalysis` as a responsive `BarChart` with semantic risk colors, subtle dark gridlines, and readable axis/legend styling.
- Placed both charts in a responsive 2-column grid below existing stats cards to create a visual command center layout.

### 22. Pipeline Health + Worker Isolation Hardening
- Added `GET /api/pipelines/:id/health` to generate a pipeline readiness report with per-action checks:
  - `DISCORD`: validates webhook URL presence and attempts reachability check.
  - `EMAIL`: performs SMTP readiness via Nodemailer `verify()`.
  - `AI_SUMMARIZER`: verifies Gemini API key presence.
- Added `PATCH /api/pipelines/:id/actions` dedicated endpoint to cleanly toggle:
  - `enabledActions`
  - `emailEnabled`
  - `discordEnabled`
- Hardened worker action execution in `src/worker/engine.ts`:
  - strict action gating now enforces `enabledActions` plus `emailEnabled` / `discordEnabled` before execution.
  - notification channel isolation is enforced: Discord/Email failures are captured in result metadata and do not fail the full task.
  - Discord send failures are now non-blocking in converter workflow and stored as structured failure details (`status`, `error`).
  - AI summary generation now respects `enabledActions` and falls back safely when disabled or unavailable.

### 23. Dashboard Logs Filtering + Pipeline Metadata UI
- Enhanced `dashboard/src/pages/logs-page.tsx` with advanced client-side filter bar:
  - Status dropdown: All / Completed / Failed / Pending.
  - Risk dropdown: All / High / Medium / Low.
  - Pipeline search by name or ID.
  - Start/end date range filtering via date inputs.
- Added `Event` column to logs table using webhook event type metadata.
- Enhanced `dashboard/src/pages/pipelines-page.tsx` cards with observability metadata:
  - Action Type summary string (e.g. `XML-Discord-Email`).
  - Created Date in short human-readable format.
  - Horizontal visual action flow with badges and arrows for active pipeline actions.
- Added modal-level `Action Preview` block before create/save submission.
- Updated frontend pipeline toggle API integration in `dashboard/src/services/pipelines.service.ts` to call dedicated backend endpoint: `PATCH /api/pipelines/:id/actions`.

### 24. Advanced Worker Routing + Production Dashboard Container
- Enhanced worker routing in `src/worker/engine.ts` to support request-level metadata overrides:
  - `metadata.skipEmail`
  - `metadata.skipAI`
  - `metadata.skipPDF`
  - (existing) `metadata.skipDiscord`
- Routing behavior now follows strict precedence:
  - pipeline action gate (`enabledActions`, `emailEnabled`, `discordEnabled`) is evaluated first
  - metadata skip flags only apply when the action is otherwise enabled by pipeline settings
  - skip reasons are recorded in structured task result metadata for observability.
- Converted `dashboard/Dockerfile` to a multi-stage production image:
  - Stage 1: `node:18-alpine` build (`npm install`, `npm run build`)
  - Stage 2: `nginx:stable-alpine` runtime serving static `dist` assets.
- Added `dashboard/nginx.conf` with SPA fallback (`try_files ... /index.html`) for React Router paths.
- Updated `docker-compose.yml` dashboard service for production behavior:
  - build arg `VITE_API_BASE_URL`
  - published port `5173:80` (Nginx runtime)
  - removed dev-only Vite runtime environment usage.

### 26. AI Chatbot (RAG System) (Complete)
- Implemented backend snapshot aggregation service at `src/services/ai-assistant.service.ts`.
- Implemented chat API endpoint `POST /api/ai/chat` at `src/api/routes/ai.routes.ts`.
- Gemini model integration now supports ops chat responses using Gemini 2.5 Flash and system-context prompting.
- Implemented floating dashboard chat widget at `dashboard/src/components/chat/ChatWidget.tsx`.
- Chat UX includes:
  - conversation history
  - input + send action
  - quick questions:
    - Why did my last task fail?
    - System Health?
- Frontend-to-backend integration is complete through `dashboard/src/services/ai-chat.service.ts`.

### 27. Multi-stage Docker (DevOps) (Complete)
- Backend Dockerfile is multi-stage (builder + production runtime) with Prisma client generation and non-root execution.
- Dashboard Dockerfile is multi-stage (build + nginx runtime) with production static asset serving.
- Container strategy now supports production deployment with smaller runtime images and clean separation of build/runtime concerns.

### 28. AI Chat UX Formatting Upgrade (Complete)
- Upgraded Ops Assistant response formatting rules in `src/services/ai.service.ts` to enforce scan-able markdown reports:
  - required sections: `### 🔍 Analysis`, `### 📊 System Stats`, `### 💡 Recommendation`
  - mandatory markdown tables for pipeline/task-count listings
  - standardized status icons: 🟢 success, 🔴 failure, 🟡 pending, ⚠️ risk
  - strategic bolding only for IDs, error messages, and key counts.
- Enhanced context derivation in `src/services/ai-assistant.service.ts` with:
  - computed `healthScore` out of 100
  - latest failed task error extraction for explicit failure quoting.
- Added frontend markdown rendering support in `dashboard/src/components/chat/ChatWidget.tsx` using `react-markdown` + `remark-gfm` so bold text, tables, and blockquotes render properly.

### 29. Pipeline Creation Defaults Fix (Complete)
- Fixed backend create flow to persist user-selected actions instead of falling back to Prisma defaults:
  - `src/api/routes/pipeline.routes.ts` now accepts `enabledActions`, `emailEnabled`, and `discordEnabled` in `POST /api/pipelines`.
  - `src/api/controllers/pipeline.controller.ts` now maps and normalizes these fields into Prisma `create`.
- Fixed dashboard create modal payload to send full action configuration:
  - `dashboard/src/pages/pipelines-page.tsx` now includes create-time action toggles for XML, AI, PDF, Email, and Discord.
  - Form submission now sends full `enabledActions` plus channel booleans.
  - Added guard to prevent creating pipelines with zero enabled actions.
- Updated create input contract in `dashboard/src/services/pipelines.service.ts` to require full action configuration payload.

### 30. Worker Reality Sync + Event-Based Webhook Routing (Complete)
- Refactored worker execution in `src/worker/engine.ts` to persist real artifacts and action outcomes:
  - XML output is saved into task result (`xml`, `xmlOutput`).
  - PDF output metadata is saved (`sizeBytes`, `contentBase64`, `pdfUrl` data URI).
  - Action-level statuses are persisted in structured `actions` map (`xml`, `ai`, `pdf`, `email`, `discord`) with real success/failed/skipped states.
  - Removed placeholder/mock success behavior for primary action execution path.
- Added pipeline-scoped delivery config support:
  - Discord sender now accepts webhook override (`src/services/discord.service.ts`).
  - Email sender now accepts per-request SMTP override (`src/services/email.service.ts`).
  - Worker reads overrides from `pipeline.config` and records config source in result metadata.
- Implemented event-based webhook routing in ingestion:
  - `src/api/controllers/webhook.controller.ts` now extracts incoming event from `eventType`, `type`, or `event`.
  - For pipeline-level ingestion (`POST /api/webhooks/:id` where `id` is pipeline), webhook configuration is selected by matching `eventType` and `isActive`.
  - Added explicit validation for missing event type and mismatch cases.
- Hardened webhook route error responses in `src/api/routes/webhook.routes.ts` for event-routing validation failures.
- Updated dashboard sync path:
  - `src/api/controllers/dashboard.controller.ts` now exposes normalized `actions`, `xmlOutput`, and rich PDF metadata to frontend.
  - `dashboard/src/services/logs.service.ts` now avoids false all-success defaults and reads persisted action states from result.
  - `dashboard/src/components/logs/LogDetailDrawer.tsx` now shows true timeline states, actual XML output, and openable generated PDF content when available.

### 31. Visual Event Webhook Management UI (Complete)
- Added Event Webhooks management section in `dashboard/src/pages/pipelines-page.tsx` under each pipeline card.
- UI now supports row-based event configuration with:
  - Event Type
  - Target URL
  - Active/Inactive status toggle
- API integration added in `dashboard/src/services/pipelines.service.ts`:
  - `getPipelineWebhooks(pipelineId)`
  - `createPipelineWebhook(pipelineId, payload)`
  - `updatePipelineWebhookStatus(pipelineId, webhookId, isActive)`
- Backend support added for status toggle persistence:
  - `PATCH /api/pipelines/:id/webhooks/:webhookId` in `src/api/routes/pipeline.routes.ts`
  - controller handler in `src/api/controllers/webhook.controller.ts`
- Logs page now displays event type as a blue badge in `dashboard/src/pages/logs-page.tsx`, making event-based routing visible in monitoring view.

### 32. Docker Build Recovery Runbook (Complete)
- Resolved Docker BuildKit snapshot corruption error during dashboard image export:
  - `failed to prepare extraction snapshot ... parent snapshot ... does not exist`
- Recovery steps validated:
  1. `docker builder prune -af`
  2. `docker buildx prune -af`
  3. `docker compose build --no-cache dashboard`
  4. `docker compose down && docker compose up --build -d`
- Verified services are up after rebuild:
  - `webhook_postgres` healthy
  - `webhook_app` started (health initializing)
  - `webhook_dashboard` started on `5173`

### 33. Manual Task Dispatcher UI & API (Complete)
- Added backend manual dispatch endpoint: `POST /api/pipelines/:id/trigger` in `src/api/routes/pipeline.routes.ts`.
- Implemented internal dispatcher in `src/api/controllers/pipeline.controller.ts`:
  - accepts JSON payload (+ optional `eventType` context)
  - bypasses external webhook validation path
  - creates task + enqueues pg-boss job for full worker execution (AI/XML/PDF/Email/Discord)
  - tags manual dispatches using payload metadata `origin: MANUAL`.
- Worker result metadata now includes task origin (`MANUAL` vs `WEBHOOK`) in `src/worker/engine.ts`.
- Added dashboard manual trigger UX in `dashboard/src/pages/pipelines-page.tsx`:
  - Trigger button (Play icon) on each pipeline card
  - Modal with event type dropdown and JSON payload editor
  - Run Pipeline action that dispatches to new trigger endpoint
  - Success feedback with direct link to corresponding log.
- Added log deep-link support in `dashboard/src/pages/logs-page.tsx` via `?logId=` query param for immediate post-trigger inspection.

### 34. Audit Origin Badges in Logs (Complete)
- Added `Origin` metadata exposure in backend logs API normalization (`src/api/controllers/dashboard.controller.ts`) with source values:
  - `MANUAL`
  - `WEBHOOK`
- Added `origin` typing and normalization in frontend logs service (`dashboard/src/services/logs.service.ts`).
- Updated logs table UI (`dashboard/src/pages/logs-page.tsx`):
  - New `Origin` column
  - Purple badge + Play icon for `MANUAL`
  - Blue badge + Cloud icon for `WEBHOOK`
  - Tooltip hint per badge (`Triggered from Dashboard` vs `Triggered via API/Webhook`)
  - Added Origin filter (`All`, `Manual`, `Webhook`) for faster audit slicing.

### 35. Discord XML Delivery Hardening (Complete)
- Updated `src/services/discord.service.ts` to deliver XML as a real file attachment using `FormData` + `payload_json`.
- Message body now sends concise AI summary in `content` and attaches `result.xml` (`application/xml`) for professional channel output.
- Added explicit failure fallback for missing webhook URL with clear message: `Missing Webhook URL`.
- Added terminal-level diagnostics with `console.error` that logs Discord response details (`status`, `statusText`, `body`) for debugging 400/401 and similar API failures.

### 36. Pipeline Creation UX Simplification (Complete)
- Removed redundant `Action Type` dropdown from Create Pipeline modal in `dashboard/src/pages/pipelines-page.tsx`.
- Unified creation flow around the 5 action toggles only (XML, AI, PDF, Email, Discord).
- Improved toggle section as a clean feature checklist/grid with selected flow preview.
- Submit logic now derives a primary action internally from selected toggles and sends:
  - `enabledActions` array
  - channel flags (`emailEnabled`, `discordEnabled`)
  - toggle state snapshot in `config.featureFlags`.
- Updated create API contract in `dashboard/src/services/pipelines.service.ts` to allow optional `config` payload.

### 25. Logs Pagination Limit Sync (400 Bad Request Fix)
- Resolved dashboard logs 400 failures caused by query limit mismatch between frontend and backend validation.
- Updated frontend logs client in `dashboard/src/services/logs.service.ts`:
  - default limit set to `50`
  - hard clamp added so requests never exceed `200`.
- Updated logs polling call in `dashboard/src/pages/logs-page.tsx` to request bounded page size (`100`) instead of oversized value.
- Updated backend validation in `src/api/routes/dashboard.routes.ts`:
  - `limit` max increased from `100` to `200`
  - default increased from `20` to `50`.

## Architecture Flow (Current)
- External Event Ingestion Path: `POST /api/webhooks/:id` -> eventType match (`eventType` | `type` | `event`) -> active WebhookConfiguration selection -> queue -> worker actions -> logs/dashboard.
- Internal Manual Dispatch Path: Dashboard `Run Pipeline` modal -> `POST /api/pipelines/:id/trigger` -> task creation (`origin: MANUAL`) -> queue -> worker actions -> logs/dashboard.
- Outbound Middleware Path: worker completion -> validate active core actions (`XML`, `AI`, `PDF`) succeeded with outputs -> subscriber lookup (`Subscriber.isActive`) -> unified result dispatch (5s timeout) -> per-delivery auditing in `delivery_logs`.
- Discord Routing Priority: matched webhook `targetUrl/url` -> configured fallback webhook URL (`DISCORD_WEBHOOK_URL`) -> skip with reason if no message content.
- AI Ops Path: Webhook Logs -> RAG Snapshot Service -> Gemini 2.5 Flash -> Dashboard Chat Widget.

### 41. Outbound Connectors (Subscriber Delivery) (Complete)
- Added outbound delivery auditing model in Prisma (`DeliveryLog`) with relations to `Subscriber` and `Task` plus indexed lookup fields (`subscriberId`, `taskId`, `createdAt`).
- Added migration `prisma/migrations/20260322130000_add_delivery_logs/migration.sql` creating `delivery_logs` with FK integrity and cascade cleanup.
- Implemented unified outbound dispatcher in `src/services/dispatcher.service.ts`:
  - fetches completed task context + active subscribers for pipeline
  - sends unified payload: `{ taskId, origin, eventType, xmlOutput, aiSummary, pdfUrl, originalPayload, timestamp }`
  - enforces strict connector timeout (`5000ms`) per subscriber POST
  - records success/failure attempt metadata in `DeliveryLog` (status code, response body, duration).
- Integrated dispatcher into worker completion path in `src/worker/engine.ts` as non-blocking middleware behavior:
  - outbound failures are logged and audited
  - core task completion is not failed by subscriber delivery issues.
- Extended pipeline subscriber APIs:
  - added removal endpoint `DELETE /api/pipelines/:id/subscribers/:subscriberId` in `src/api/routes/pipeline.routes.ts`
  - controller support in `src/api/controllers/pipeline.controller.ts`.
- Added dashboard subscriber management UI in `dashboard/src/pages/pipelines-page.tsx`:
  - list subscribers per pipeline
  - add subscriber target URL
  - remove subscriber target URL.
- Added frontend subscriber service integration in `dashboard/src/services/pipelines.service.ts`:
  - `getPipelineSubscribers`
  - `createPipelineSubscriber`
  - `deletePipelineSubscriber`.

### 37. Architecture Sync: Manual Dispatch, Event Routing, Action Toggles, Discord Resilience, Origin Audit (Complete)
- Manual Dispatcher (UI -> Internal Path):
  - Dashboard supports direct internal execution through `POST /api/pipelines/:id/trigger`.
  - Trigger modal accepts JSON payload plus optional event context.
  - Manual jobs are queued via pg-boss and run through full worker flow (AI/XML/PDF/Email/Discord).
- Event-Based Routing (eventType -> targetUrl):
  - Ingestion extracts incoming event key from `eventType`, `type`, or `event`.
  - Router selects active webhook configuration by `(pipelineId, eventType, isActive)`.
  - Selected webhook URL (`WebhookConfiguration.targetUrl`/`webhook.url`) is propagated to worker dispatch and used as the first-choice delivery destination.
- Action Toggles (Independent Feature Checklist):
  - Pipeline creation/update now uses independent toggles for: `XML`, `AI`, `PDF`, `Email`, `Discord`.
  - Toggle state is persisted through `enabledActions` plus channel flags (`emailEnabled`, `discordEnabled`).
  - UI action flow display is fixed and logical: `XML -> AI -> PDF -> Email -> Discord`.
- Discord Resilience (XML-Independent):
  - Discord action executes independently of XML toggle state.
  - With XML enabled/output present: send text + `result.xml` attachment.
  - With XML disabled/missing: send text-only summary from AI summary and/or payload details.
  - With absolutely no content: mark Discord as `skipped` and avoid outbound webhook request.
- Origin Tagging (Audit):
  - Tasks now persist source origin as `MANUAL` or `WEBHOOK` in execution metadata.
  - Logs API and dashboard expose this origin for filtering, badges, and post-incident traceability.

### 38. Destructive Delete Confirmation UX Hardening (Complete)
- Added reusable confirmation dialog component for destructive actions in `dashboard/src/components/ui/confirmation-modal.tsx`.
- Modal implementation is accessibility-focused:
  - `role="dialog"` + `aria-modal="true"`
  - `aria-labelledby` / `aria-describedby`
  - keyboard Escape-to-close handling
  - focus-trap behavior with tab loop while dialog is open.
- Integrated delete flow in `dashboard/src/pages/pipelines-page.tsx`:
  - delete button now opens a dedicated confirmation modal before any destructive action executes
  - action is visually styled as destructive (red semantic button)
  - loading state is shown during deletion to prevent duplicate submissions.
- Added post-delete user feedback in pipelines dashboard:
  - success notification card after confirmed deletion
  - error notification card when deletion fails.

### 39. Atomic Retry + Exponential Backoff + STUCK Lifecycle (Complete)
- Worker engine (`src/worker/engine.ts`) now supports atomic retries by reading previous task result metadata and skipping actions that already succeeded.
- Individual action states are persisted and reused through structured map:
  - `actions: { xml, ai, pdf, email, discord }` with `success | failed | skipped | pending`.
- Idempotent retry behavior is now enforced:
  - XML/AI/PDF/Email/Discord actions with prior `success` are not re-executed on retry.
  - only failed actions are re-run in subsequent attempts, preventing redundant API calls (including Gemini).
- Retry policy upgraded across enqueue paths (`webhook.controller.ts`, `pipeline.controller.ts`, `routes.ts`):
  - `retryLimit: 4`
  - `retryDelay: 10`
  - `retryBackoff: true`
  - task `maxAttempts` standardized to `5`.
- DLQ-style lifecycle implemented using persisted status:
  - when attempts are exhausted (`attempt >= maxAttempts`), task status is set to `stuck`.
  - stuck tasks are surfaced in dashboard logs filtering and status normalization for easy operations triage.

### 40. STUCK Task Recovery UX Patch (Complete)
- Updated `dashboard/src/components/logs/LogDetailDrawer.tsx` so Retry remains visible for both `failed` and `stuck` task statuses.
- Improved failure card label to distinguish exhausted retries (`Task stuck after retries`) from normal failures.
- Updated backend manual retry in `src/api/controllers/webhook.controller.ts` to reset `attempts` to `0` when re-enqueuing a task.
- Recovery flow now correctly restarts retry budget after manual operator intervention.

### 42. Subscriber Dispatch Completion Gate (Complete)
- Tightened outbound delivery gate in `src/services/dispatcher.service.ts` so subscribers are called only after active core worker actions are fully successful:
  - Core actions considered: `xml`, `ai`, `pdf`
  - Active means action state is not `skipped`
  - Every active core action must be `success`
  - Required output must exist for each active core action (`xmlOutput`, `aiSummary`, `pdfUrl`).
- Dispatcher now skips delivery with explicit reason logging when core actions are pending/failed/missing output.
- Unified payload now includes explicit combined core outputs in `combinedResults`:
  - `xml`
  - `ai`
  - `pdf`

## Milestones
1. Backend Automation Platform: Complete
2. Worker Orchestration and Action Pipeline: Complete
3. Observability APIs and Logs Drill-down: Complete
4. Dashboard UI/UX and Monitoring Control Plane: Complete
5. AI Ops-Assistant (RAG Chat over Live Context): Complete
6. DevOps Containerization (Multi-stage Backend + Frontend): Complete
7. Dashboard Specification Coverage (`dashboard.md`): 100% Complete

## Next Steps (Deployment and Maintenance)

### Deployment
- Finalize production environment variables (Gemini, SMTP, Discord, DB, CORS) per environment tier.
- Enable CI/CD pipeline for automated build, test, image publish, and release deployment.
- Add reverse-proxy/TLS routing strategy for dashboard and API in production.

### Maintenance
- Define SLOs/SLIs for API latency, worker throughput, and failure rates.
- Add operational runbooks for queue incidents, third-party outages, and retry storms.
- Implement periodic dependency/security patching and image refresh cadence.
- Add cost and token-usage monitoring for Gemini chat usage.

## Instructions for Future Turns
> From now on, at the end of every successful task, you must update this context.md file to reflect the new state of the project.

This file is the primary architectural and progress reference. Keep it concise, accurate, and current.
