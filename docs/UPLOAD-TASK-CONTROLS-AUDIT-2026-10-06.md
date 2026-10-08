# Upload analysis task controls audit — 2026-10-06

Observed RUN-41B49C50E2C7 at 77%: awaiting_approval / fallback_paused. A1 local refinement could not establish the PPE 3/5 threshold. It has no final verdict; saved frames remain intermediate evidence.

Upload results now display per-rule outcome and reason, continue-fallback/cancel controls, and evidence navigation. Task detail offers the same controls and refreshes active tasks. Reload retrieves existing runs by video instead of hiding them or redispatching completed analysis. Poll failures are visible.

Cancellation is persistent and idempotent; finished tasks reject cancellation. Worker checks cancellation before subsequent provider calls and business event persistence, preserving costs/observations. An already-issued provider request cannot be recalled. No real paused task was resumed or cancelled during this fix, and no additional model spend was triggered.

Verification: verify-upload-controls.log, 126 backend / 66 frontend tests passed and production build. API cancellation tests use isolated test data and check terminal conflicts, paused resume denial and preserved usage; provider guard test verifies no call after cancellation. Actual paused task browser view shows reason, intermediate evidence and both controls. Existing prototype shell and button/card tokens reused. Current IAB view is narrower than the 1280 target and has existing shell overflow; no exact-width claim is made.
