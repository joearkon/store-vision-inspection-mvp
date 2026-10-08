# Rule configuration prototype alignment — 2026-10-08

Reference: prototypes/new-product-oct8/components/AIRulesPage.jsx (user supplied Demo (3)).

Replaced the simplified image-check block and old capability-only rules page with the supplied prototype's rules-page layout: breadcrumb/header/import/new rule, four statistics cards, analysis profiles, type/status/search filters, rule rows, 680px right drawer, configuration/observation/sample/version tabs and footer actions. Retained template-specific configuration fields, business categories, severity, input type, ROI, confirmation thresholds, stores/time and notification configuration. Added structured image standards and reference upload inside the state-check template as required for actual visual verification. Replaced global browser components/data with module imports and current capability catalog; removed random sample AI and unused fabricated sample records. New image sample tests use actual persisted standard snapshots and the real vision API.

Configuration drafts and submissions persist in SQLite. Stable rule IDs and appended version history survive reload; empty image standards cannot submit for testing. Real localhost API smoke: RULE-ae1c24504308, v2, two version records. Synthetic new-product draft seeded for review, explicitly named synthetic. Notifications are saved configuration only; this generic builder does not enable arbitrary new video detectors, POS integrations or automatic production publication. Video/business templates can be configured but require their respective verification pipelines; single photos cannot certify temporal/event-flow behavior.

Visual layout ported directly from reference source, including spacing, grid and drawer styles; bitmap icons replaced by existing SVG icons. Browser acceptance blocked: CUA trusted Node crashes during initialization. No screenshot or actual click verification claimed. Automated SSR covers initial page/new-rule drawer/all tabs/empty samples/version rendering. Backend tests cover persistence/versioning/submission rejection/source-rule lineage. Full verification log: data/rules-prototype-verify.log.

Correction: an intermediate claim about duplicate declarations in the latest supplied rule source was based on overlapping source excerpts; that was not the cause of a reproduced current white-screen. Production module build and renderer checks are used to validate the actual port.

No Cloudflare deployment in this change. Online remains previous version; local rules page is the review target.

Final verification: 133 backend tests and 75 frontend tests passed; production build passed. Browser visual/click gate remains unpassed.

## Shared styles restoration

Found concrete dependencies omitted in initial port: undefined primary-button/secondary-button classes, Button size prop forwarded to DOM rather than applied, missing slideInRight keyframes, no approved page-fade class, and Card did not forward reference style/default padding. Restored scoped prototype button variants/sizes/hover states, exact Card border/shadow/default padding and style forwarding, page entry and drawer slide keyframes, form focus styling and thin scrollbars. Kept inline reference styles for row hovers/tab active states and 0.15s transitions. Added reduced-motion support. Browser screenshots/click acceptance still unavailable; this is source alignment plus build/render verification, not a claim of pixel-perfect visual acceptance.
