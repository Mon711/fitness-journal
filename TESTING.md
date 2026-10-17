# Verification record — 17 October 2026

## Entry-state update

All modifying tests use a dedicated local synthetic database at `.sites-runtime/qa-state`. The normal preview uses `.wrangler/state`; its existing user entry was not edited or deleted. The only change to that normal local database was the additive `filled` column migration, preserving previous observations. No hosted journal database was touched.

- **11 unit tests passed**: existing calendar, clock-time, null, CSV and phase tests, plus explicit entry states, boolean validation, legacy request defaults, and history/start-date boundaries.
- **13 integration scenarios passed** (Node reports 14 including the parent). The actual production Worker and local D1 were used through `npm run start:test` at fixed loopback port 8787.
- Integration coverage: anonymous denial; cross-origin/missing-origin write denial; invalid dates/times; create/read/edit/delete; independent users; inclusive date ranges; missing dates; phase metadata/defaults; CSV scope; read-only MCP discovery and write rejection; Filled round-trip through both browser API and MCP (including range reads and CSV); reopening as Started; rejection of writes before 17 October.
- **TypeScript passed** and **production build passed**.
- Migration `0001_dapper_deadpool.sql` adds one non-null boolean column with a constant false default. Existing saved observations remain Started rather than being assumed Filled.

## Actual browser checks

Using the isolated QA preview on port 5175:

1. An empty day showed Not recorded. Selecting workout A immediately showed Started · Unsaved beside the date and Started in the week strip.
2. Saving the partial record showed Your entry is saved, the saved details and Edit entry. Optional fields stayed Not recorded.
3. Mark day as filled changed the date label and week marker to Filled. This persisted after a full reload.
4. Edit entry reopened the controls. Changing the workout to B and adding synthetic notes saved correctly while retaining the explicit Filled confirmation.
5. History began at Saturday 17 October under Week 1, with no earlier daily rows and a Filled label on the recorded day.
6. Mark as started again removed the Filled confirmation without removing observations; marking Filled again restored it.
7. Deleting the disposable QA record through its confirmation returned the day to Not recorded.
8. Rendered saved-summary layouts inspected at 390px phone, 768px tablet and 1440px desktop. The date and context remain visible; Edit entry is above the saved details. No real data appears in saved QA screenshots.

## Local tooling and release boundary

`npm run dev:test` and `npm run start:test` use the dedicated QA database. Stop the development preview before built-server testing and avoid rebuilding while a built server is running. The macOS Codex sandbox uses file polling to avoid native watcher errors. Test requests drain response bodies, use fresh HTTP connections to avoid stale local Wrangler sockets, and retain eight-second timeouts. No assertion accepts a failure status as success.

The Site remains owner-private and unpublished pending preview review. The prior native access-policy check allowed only the owner, with no external visitors, groups or other editors. MCP behavior is verified locally; hosted sign-in and plugin installation still require first publication and a subsequent read-only smoke test.

Local databases, real records, exports, credentials, screenshots and QA harness files remain ignored by Git.
