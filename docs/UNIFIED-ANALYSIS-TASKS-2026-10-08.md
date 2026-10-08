# Unified analysis list — 2026-10-08
- Video and image tasks share the existing runs-table, status tabs, filters, progress, usage and pagination. All tasks merges both APIs and counts both types.
- Image pass/fail/review/missing-photo remains separate from video event/zero-event filters.
- Image API persists created_at, started_at, completed_at and active_seconds for new analysis; old records display missing creation time honestly.
- Per-image detail routing preserved. Existing menu task results remain available.
- Automated regression: data/unified-runs-verify.log. Browser sandbox remains unavailable, so visual/click acceptance is outstanding.

User correction: video list restored verbatim from b2601ac. Images use separate scoped table. All tasks shows image section first and video section after, avoiding old images being buried by video pagination. Confirmed newest menu IMG-TASK-b7c6bea329c2 exists and completed at 23:10. Image detail follows compact 18/14/12/11px heading/body hierarchy, 130–160px side-by-side thumbnails, click-to-open original, responsive single-column check cards. Browser visual acceptance still blocked.

Final user requirement: one common runs-table for all three tabs, preserving baseline video rows. Tabs filter the merged task data; single pagination/count and common progress/status/usage layout. Legacy image task timestamp falls back to actual completed_at solely for ordering/display, with tooltip stating missing creation time. Added regression requiring latest legacy image to appear before 12 older videos. Synthetic snapshot export preserves actual timestamps.
