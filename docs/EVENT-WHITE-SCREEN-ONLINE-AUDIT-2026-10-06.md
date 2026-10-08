# Event white-screen fix and full online route audit — 2026-10-06

Root cause: EventDetail accidentally included analysis-run polling referencing undefined run. Removed the stray effect; RunDetail polling retained. Added EventDetail loading-render regression test. Local EVT-1006-19D989 rendered evidence, video controls and timeline after the fix.

verify-event-white.log: 127 backend tests / 70 frontend tests passed and build succeeded. Published to https://4a4b6d1d.store-vision-inspection-static.pages.dev (production alias updated). This also includes the latest SOP KPI correction.

Browser inspection against production, not HTTP-only checks: clicked every one of the 12 menu entries; revisited after data loaded and checked visible headings/content. Opened all 19 existing event detail URLs, all 51 run URLs, all 9 camera detail URLs and all 4 SOP task URLs. Inspected preserved operations and login routes. All 97 routes showed their expected contents; no captured console errors during this audit. Inspection did not submit changes, notifications or paid analysis.

Evidence: data/online-browser-audit.json with per-route results; data/online-event-fixed.png for the reported refrigerator event; data/online-*.png for menu views. Browser viewport used its normal IAB sizing. Read-only/unsupported online upload and operations routes display explicit unavailable messages rather than white screens. This is rendering/navigation coverage, not full mutation or live-provider integration testing.
