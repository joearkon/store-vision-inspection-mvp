# Store Vision Inspection Delivery Rules

These rules apply to every change in this repository.

## Required context

Before changing product behavior or UI, read:

1. `docs/MVP-SCENARIOS-TECHNICAL-DESIGN.md`
2. `docs/VISUAL-IMPLEMENTATION-CONTRACT.md`
3. `prototypes/visual-baseline-v1/README.md`

The prototype is the visual baseline. Business state and technical truth come from the MVP design document.

## Product rules

- Never present a mock, timer, random confidence, placeholder stream, or synthetic result as a real AI result.
- Keep frame observations separate from aggregated business events.
- Severity, SLA, rule text, and notification policy are server-side rule configuration, not free-form model output.
- An event must preserve evidence and audit history when marked false-positive or resolved.
- Notification failure must not rewrite a successful analysis as failed.
- Do not add RTSP, SMS, phone alerts, automatic punishment, or cross-system synchronization without explicit scope approval.

## Visual rules

- Reuse the prototype shell, tokens, spacing, density, component patterns, and restrained motion.
- Use SVG icons; do not use emoji as product icons.
- New pages must look like part of the existing prototype, not a new template or UI kit.
- Verify at a 1280×720 desktop viewport and inspect loading, empty, failure, no-permission, long-content, and completed states as applicable.
- Treat visible deviation from the approved prototype as a defect unless the product requirement demands the difference.

## Engineering gates

- Add or update automated tests for every behavior change and bug fix.
- Run `./scripts/verify.ps1` before delivery.
- Keep long-running video work in the persistent worker, not FastAPI in-memory background tasks.
- Persist task state before starting external work and make retries idempotent.
- Do not commit `.env`, credentials, uploaded video, extracted frames, evidence, SQLite databases, logs, `node_modules`, or build output.
- Keep the real Doubao provider as the runtime path. Test doubles are allowed only in automated tests.

## Delivery audit

Every phase must update or add a product audit under `docs/` containing:

- implemented scope;
- automated test evidence;
- product logic audit;
- visual comparison result;
- known gaps and unpassed integration gates.

Do not claim a real external integration has passed unless it was exercised with the configured service and evidence was inspected.
