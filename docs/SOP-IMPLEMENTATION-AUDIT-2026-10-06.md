# SOP implementation audit — 2026-10-06

Latest prototype: prototypes/sop-v5, supplied in 门店视觉巡检 Demo (5).zip. SOP task and template layouts reuse this baseline. The original invalid Icon expression was fixed when adapting the prototype to modules.

Schedules: opening check 09:10–09:30, normal checks 11:00 and 16:00, closing check 22:30. Store operating hours are 09:00–23:00 (14 hours). Inspection is the final navigation group; operations configuration remains accessible by route but its menu entry is hidden.

Existing mopping analysis RUN-58EAF86B7061 is linked to the opening task. The user's subsequent manual mask verification is preserved. The task is completed with 2/2 checks; raw analysis and audit records are preserved. Supported visual bindings are A1, C1 and M1; other checks use manual verification. A short PPE clip requires review rather than proving compliance across a full task window.

Latest UI change removes the entire manual verification summary card while retaining item results, the AI summary, and the evidence submission form. Local page screenshot: data/sop-card-removed.png. Actual browser screenshot was reviewed; the viewport override did not provide a reliable requested-width simulation and was reset.

Verification: scripts/verify.ps1 passed, 124 backend tests and 64 frontend tests, including SOP rendering regressions, and production build. Log: data/verify-sop-card-removed.log. No new external model calls were performed for this UI change.

Cloudflare deployment: https://11e5015e.store-vision-inspection-static.pages.dev . Public showcase exports existing records and evidence images with read-only SOP behavior; no original videos or credentials are included. Live camera ingestion and automatic missed-SOP reminders are not implemented by this change.
