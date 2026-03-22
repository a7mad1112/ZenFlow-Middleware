Phase 0: UX & Safety (Immediate Impact)
Goal: Prevent accidental data loss and improve user confidence.

[x] Destructive Action Guards:

[x] Implement a Confirmation Modal for deleting Pipelines.

[x] Add a "Type-to-Confirm" or a simple "Are you sure?" toggle to prevent accidental one-click deletions.

[x] Ensure a success/error toast notification appears after the deletion is finalized.

Phase 1: Reliability & Advanced Retry Logic
Goal: Ensure the system is resilient to partial failures and cost-efficient.

[x] Partial/Atomic Retry Mechanism:

[x] Refactor the Worker Engine to support re-running only failed actions (e.g., if XML/AI succeeded but Email failed, retry only the Email).

[x] Persist individual action states (success, failed, skipped) within the task metadata to prevent redundant API calls or double-billing on Gemini tokens.

[x] Smart Exponential Backoff:

[x] Configure pg-boss with an escalating retry strategy: 10s → 20s → 40s → 1m → 2m.

This ensures quick recovery for minor network blips while backing off to protect resources.

[x] Dead Letter Queue (DLQ) & Recovery:

[x] Add a "Stuck Tasks" tab in the Dashboard for jobs that exhausted all 5 retries.

[x] Implement a "Manual Re-queue" button to force a final attempt after fixing external issues (like updating an expired API key).

Phase 2: Outbound Connectors (Subscriber Delivery)
Goal: Transform the platform into a Middleware for programmatic systems.

[x] Subscriber Management System:

Schema update: Create a Subscribers table linked to Pipelines (1:N).

UI: Add a management section for external target URLs (Webhooks Outbound).

[x] Outbound Webhook Dispatcher:

Build a Dispatcher Service to perform HTTP POST requests to external systems upon task completion.

Standardize the "Unified Result" payload (XML body + AI Insight + PDF URL + Audit Metadata).

[x] Delivery Auditing:

Log every outbound attempt with HTTP status codes and response bodies for external troubleshooting.

Phase 3: Security & Performance Hardening
Goal: Protect the ingestion layer and ensure scalability.

[ ] Webhook Signature Verification (HMAC):

Generate and store a Secret Key per Pipeline.

Add middleware to validate incoming X-Hub-Signature or Authorization headers to ensure data authenticity.

[ ] Rate Limiting & Throttling:

Implement express-rate-limit to prevent "Webhook Flooding" at the ingestion layer.

[ ] Idempotency Guard:

Ensure the system ignores duplicate Webhook IDs within a 24-hour window to prevent double-processing.

Phase 4: Quality Assurance & CI/CD (Fully Modularized & Verified)
Goal: Maintain high code quality and stable releases.

[x] Automated Testing Suite (Jest):

Unit Tests for core services (XML, PDF, Gemini Prompting).

Integration Tests for the full Ingestion -> Queue -> Worker lifecycle.

Dashboard smoke tests with React Testing Library.

[x] GitHub Actions CI (3-Tier Parallel Architecture):

Automate Lint, Build, and Test checks on every Push/Pull Request.

Modular CI with 3 independent parallel jobs: Linting, Backend Tests, Dashboard Tests.

Node.js 22 with GitHub deprecation warning suppression (FORCE_JAVASCRIPT_ACTIONS_TO_NODE24).

[x] Interactive API Docs (Verified & Fixed):

Swagger/OpenAPI now uses explicit path definitions in src/docs/swagger.ts (no route auto-scanning), and endpoint docs are confirmed visible in Swagger UI.

[x] Swagger Try-it-out Endpoints Functional:

Verified Swagger route discovery and executable endpoint mappings for webhook ingestion and pipeline APIs.

Phase 5: AI Ops & Intelligence
Goal: Transition from "Monitoring" to "Predictive Operations".

[ ] Proactive Anomaly Detection:

Use Gemini to analyze failed logs and flag patterns (e.g., "Pipeline X is failing because the input JSON structure changed").

[ ] Smart Payload Diffing:

A UI tool to visually compare the JSON of a Successful task vs. a Failed task to find missing fields quickly.

[ ] Token Usage & Cost Tracking:

Track Gemini 2.5 Flash token consumption per Pipeline and display it in the analytics dashboard.