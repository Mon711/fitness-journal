# Verification record — 17 October 2026

All test observations are synthetic. Hosted production journal records were never created, read or modified during testing.

## Automated checks

- Unit suite: **8 passed**. Calendar and leap-date validation; phase numbering and boundaries; null observations; clock times with explicit bedtime date; invalid selections/times; optional alcohol quantity; phase validation; quoted/multiline/formula-safe CSV.
- Built-server integration suite: **11 scenarios passed** (Node reports 12 including its parent test). Real local D1 and the production Worker were exercised at the fixed loopback URL `http://127.0.0.1:8787`.
- Integration coverage: anonymous API/MCP denial; cross-origin/missing-origin write denial; malformed inputs; create; edit; inclusive range reads; missing-day nulls; two-user read/delete isolation; independent records for the same date; isolated phase metadata; CSV scope; MCP discovery and three read-only tools; rejection of a write-tool attempt; deletion.
- TypeScript: **passed** (`tsc --noEmit`).
- Production build: **passed**, generating the page, two browser APIs and `/mcp`.
- Initial SQL migration: applied successfully to the local database only.

Local test infrastructure needed two fixes: the macOS Codex sandbox produced native filesystem watcher errors (`EMFILE`) and occasional Worker restart 503s, so `scripts/sites-env.mjs` now selects polling for that sandbox. The HTTP test helper now consumes every response body, including denial responses, before reusing a connection; this removed intermittent connection timeouts. Calls have an eight-second timeout. The final complete integration suite passed twice consecutively. No assertion was weakened to accept an error status.

## Actual browser checks

Using the in-app browser against the local development UI:

- Configured a synthetic 16-week phase and verified Day 1 / Week 1 context.
- Created a daily entry, selected workout A, entered 23:45 bedtime and 07:15 wake-up, alcohol Yes with a quantity, junk food No and synthetic notes.
- Saved, opened the day from chronological history, and verified all values persisted.
- Changed workout A to B and edited notes, saved, and verified the updated state.
- Deleted the disposable entry through the confirmation UI. The day returned to unrecorded, with all observations empty.
- Inspected actual rendered layouts at **390px phone, 768px tablet and 1440px desktop** widths using a local iframe QA harness (not shipped). Phone uses bottom navigation; larger layouts use a sidebar, with supporting cards rearranged to fit.
- Fixed repeated pre-phase history headings found during inspection.

CSV content and response headers were verified through the real API. Browser QA uses local simulated identity; it does not establish hosted OAuth/plugin installation status.

## Publication boundary

The native Sites access policy was inspected: the owner is the only allowed account, no external visitors, no groups and no additional editors. The Site remains unpublished until local preview review. Hosted identity enforcement and the connected plugin must receive a read-only smoke test after first publication. Sites does not expose MCP connection details before publication; the native tool confirms that restriction.

The source, SQL migration and automated tests are versioned. Local databases, synthetic observations, exports, credentials, screenshots and QA harnesses are ignored.
