# SOP KPI correction audit — 2026-10-06

Replaced the ambiguous completed-task pass rate headline with daily task completion. One completed task out of four is 25%; evidence verification progress is shown separately (2/29 items). AI verification share counts AI terminal checks among all terminal checks, excluding unverified/review records from the denominator. Current one AI and one manual check yields 50%, not 3% of all scheduled items. This is a share of recorded verification, not model accuracy.

Problem card now says confirmed problems and explicitly reports review/unverified counts. Zero confirmed failures does not imply all pending inspections passed. Empty verification metrics show a dash.

Added regression tests for four-task/29-item example, cross-task record scoping, review exclusion, empty denominator and pending tasks. Verification log: data/verify-sop-kpi.log. UI reuses existing KPI cards and prototype styles. No task records, evidence or external model calls were changed.
