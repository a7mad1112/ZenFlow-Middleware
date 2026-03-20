# Project Context (Single Source of Truth)

## Current Progress

### 1. Ingestion API (Webhooks / Pipelines)
- Pipeline management endpoints are implemented (create, list, update, delete).
- Webhook registration and ingestion endpoints are implemented.
- Incoming webhook payloads are accepted, validated, and tracked with task/log identifiers.

### 2. Background Processing (Worker Engine + pg-boss)
- Jobs are enqueued through pg-boss and consumed by worker engine instances.
- Worker lifecycle handles processing, success, and failure status updates in the database.
- Retry behavior is delegated to pg-boss job policies.

### 3. Action 1: XML Converter
- JSON payload is sanitized and transformed into XML.
- XML output is stored in the task result field for traceability.

### 4. Action 2: Discord Notifier
- Converter results can be forwarded to Discord via webhook.
- Discord failures are logged and reflected in task/error state based on current workflow logic.
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

### 9. Dashboard Blueprint (Planning Complete)
- A comprehensive feature specification has been created in `dashboard.md`.
- Scope includes pipeline management, action configuration, conditional routing UI, live monitoring, execution drill-down, required API expansion, Docker frontend integration plan, and dark-mode product design direction.

### 10. Dashboard Support APIs (Complete)
- Implemented `GET /api/stats` for total tasks, success rate, grouped status counts, and AI risk distribution.
- Implemented `GET /api/logs` with pagination and filtering by status, pipelineId, and riskLevel.
- Implemented `GET /api/logs/:id` returning full task detail including payload and action outputs (XML, AI summary, PDF/email/discord execution metadata when available).
- Worker task result payload is now persisted as structured execution details to support dashboard drill-down views.

## Future Plan (Roadmap)

### Monitoring and Operations
- Build dashboard/API views for operational tracking.
- Expose failed vs completed task metrics, retries, and action-level error summaries.

## Instructions for Future Turns
> From now on, at the end of every successful task, you must update this context.md file to reflect the new state of the project.

This file is the primary architectural and progress reference. Keep it concise, accurate, and current.
