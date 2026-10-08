# Explicit upload detection scope audit — 2026-10-06

Upload now has separate collapsible optional severity and detection-rule selectors. Rule selection supports multiple implemented rules with code and name. Severity filters selection and dispatch; it does not overwrite server-side event grading. Empty rule selection retains automatic matching.

Explicit non-table rules upload without a scene job and queue only selected rules. New unknown sources are persisted rather than attributed to the storage camera. Explicit rule runs still enforce store enablement and idempotent video/rule dispatch. G2 retains scene/ROI identification and analysis is restricted to selected rules. M1 asks for video start time and does not infer a complete missing-cleaning window.

Test evidence: verify-explicit-rules.log. Added API coverage for absence of scene jobs, unknown source, selected A1 idempotency, disabled rule rejection, and missing table ROI rejection; frontend coverage for selection intersection and updated optional labels. Browser selected A1 successfully, collapsed options follow existing prototype component styles. Screenshot: data/upload-rule-selection.png. Browser dimensions remain the existing IAB dimensions; no exact 1280 simulation claimed. No actual monitoring video was submitted and no new model spend occurred in this verification.

The change avoids scene matching and unrelated rules when the user specifies non-table rules. It does not eliminate frames necessary to verify the selected rule's temporal evidence. Cloudflare remains a read-only snapshot; this change is implemented and verified on the local upload flow.

Deployment: https://aa02d748.store-vision-inspection-static.pages.dev ; production HTTP 200 and index-CV29NL8C.js verified. Snapshot includes 51 analysis records, 19 events and 79 event evidence images. Cloudflare showcase remains read-only for model execution and task cancellation.
