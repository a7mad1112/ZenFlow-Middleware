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
- SMTP/env failures are logged without crashing worker execution flow.

### 6. Smart Routing (Conditional Action Logic)
- Pipeline-level action gating is in place for Discord (with schema-level direction for feature flags/arrays).
- Request-level metadata can selectively skip actions (currently Discord override is implemented).
- Skip decisions are logged with explicit reason messages.

## Future Plan (Roadmap)

### Action 4: PDF Generator
- Build invoice-style PDF generation (PDFKit).
- Generate and store PDF artifacts tied to processed tasks.

### Integration: PDF + Email (Action 3)
- Attach generated invoice PDFs to confirmation emails.
- Expand email template to include invoice metadata and attachment references.

### Action 5: AI Summarizer (Gemini API)
- Add AI summarization action for payload/result insights.
- Store summary output and confidence/metadata in task result model.

### Monitoring and Operations
- Build dashboard/API views for operational tracking.
- Expose failed vs completed task metrics, retries, and action-level error summaries.

## Instructions for Future Turns
> From now on, at the end of every successful task, you must update this context.md file to reflect the new state of the project.

This file is the primary architectural and progress reference. Keep it concise, accurate, and current.
