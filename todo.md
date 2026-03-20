# Remaining Tasks Checklist (Audit Follow-up)

## Backend & API Gaps
- [x] Implement `GET /api/pipelines/:id/health` (Readiness checks for SMTP, Gemini, Discord).
- [x] Implement `PATCH /api/pipelines/:id/actions` (Dedicated endpoint for clean action toggling).
- [x] Hardening: Isolate Discord/Email failures so they don't fail the entire task (Channel-specific error logging).

## Dashboard UI Enhancements
- [ ] Add Filters to Logs Table (Status, Pipeline, Risk Level, Date Range).
- [ ] Add "Webhook/Event Type" column to the Logs table.
- [ ] Display "Action Type" and "Created Date" in Pipeline cards.
- [ ] Add "Action Preview" (Visual flow) before saving pipeline changes.

## Logic & Reliability
- [ ] Implement `skipEmail` and future `skipAI` / `skipPDF` flags in the Worker engine.
- [x] Implement Worker-level check for `emailEnabled` and `enabledActions` (Strict enforcement).

## DevOps
- [ ] Convert Frontend Dockerfile to Multi-stage (Build with Node -> Serve with Nginx).