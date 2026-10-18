# Verification record

## Authenticated MCP writes — 18 October 2026

- Added `save_entry` (create/partial edit), `delete_entry`, `update_phase` (create/partial edit) and `reset_phase` (restore defaults without removing entries). The existing three read tools remain available. Every operation uses the trusted signed-in Site identity and the same owner-scoped storage as the UI. No schema migration or hosted test insertion is needed.
- **24 unit/service tests passed**, including six new checks for partial edits, null/omission semantics, preserved Filled confirmation, invalid input/account selector rejection, timeline validation, and accurate read/write tool annotations. TypeScript and the production build passed.
- **19 built API/MCP scenarios passed** against loopback-only synthetic accounts. New coverage verifies MCP create/edit/delete, independent same-date records for two users, UI/MCP storage consistency, timeline edit/reset isolation, preserved entry data after resets, denial with either identity header missing, anonymous denial, rejected account selectors, invalid patches, rejected cross-origin/plain-text calls, and authenticated server-to-server calls with no Origin. All synthetic test entries and timeline settings are cleaned up.
- **Actual browser regression checks passed** once access was restored: created and saved a synthetic October 18 entry with independent clock times, edited notes, marked Filled, inspected history, reopened as Started, and deleted only the disposable QA entry. Timeline title/duration saved and were restored to their original synthetic values. Checked phone/tablet/desktop layouts at measured CSS widths 390, 768 and 1440, with document width equal to viewport width (no horizontal overflow). The browser's scaling required larger viewport override values to achieve these measured widths. The Settings privacy text now accurately describes signed-in MCP write access.
- Plugin Management confirms the existing Fitness Journal plugin is already installed in the owner's account. An authenticated `get_phase` call through that plugin succeeded, returning the owner's phase metadata. No real journal records were written or deleted during testing; hosted verification uses a read only.
- Final verification exposed intermittent errors from Wrangler's local proxy: its 503 response explicitly said the Worker restarted mid-request, including on rejected calls. A direct validation request returned the expected 400 immediately. The same built Worker modules and compatibility flags were therefore run directly in the installed Miniflare runtime, with a separate synthetic database at `.sites-runtime/mcp-direct-state`. **All 19 unchanged integration scenarios passed** there, with no retries or relaxed assertions. The temporary direct-runtime harness is ignored in `.sites-runtime/verify-built.mjs`; production code was not changed to compensate for the development proxy.

## In-page entry actions update

- Removed the explicit scroll-to-top after saving and entering edit mode. Saves and Started/Filled changes use the confirmed server response to update the current entry and in-memory history; deletion removes the date locally only after server success. The initial page load still reads journal/phase data normally.
- Added outlined, icon-labelled 44px-minimum buttons for **Mark as started again** and **Delete this entry**, including the delete control in edit mode. Pending operations disable controls; deletion keeps its confirmation and shows Deleting while pending.
- **18 unit/service tests passed**, **TypeScript passed**, **production build passed**, and **all 14 built API/MCP scenarios passed** against isolated local synthetic data.
- **Actual browser checks passed** in the isolated port-5175 preview once browser access became available: reopened a Filled synthetic entry as Started, created a separate October 18 record, saved it, edited its notes, marked it Filled, inspected the updated Journal row, cancelled deletion, and then deleted that disposable record. The date and week marker returned to Not recorded. Save, reopen and delete stayed within the page at the scrolled position; no forced return to the top was observed.
- The development-server request log showed only the expected PUT/DELETE requests for those actions, with no additional document load or journal/phase reload. The page and quote remained mounted. Natural scroll adjustment when the long form becomes a shorter summary is expected.
- Inspected the actual UI at **390×844 phone**, **768×1024 tablet** and **1440×1100 desktop** sizes. The outlined icon buttons have visible borders and 44px minimum height; the action row wraps on phones and sits side by side on larger screens. Saved synthetic phone/desktop screenshots in ignored `outputs/`.
- No ordinary local journal records or hosted database were modified. All required checks passed before GitHub/Sites source synchronization and artifact preparation; production publication still awaits preview review.

## Daily-quote update

- **18 unit/service tests passed**: the original 11 journal tests plus seven quote tests using an in-memory SQLite database and the actual quote-cache migrations. They cover India-midnight rollover, bounded plain-text validation, daily reuse, next-day fetch, concurrent request claiming, outages/cooldown/recovery, rate limits, rejected redirects malformed replies, and isolation between signed-in identities.
- **14 built API/MCP integration scenarios passed**, verifying the journal and quote endpoint together, including anonymous quote denial and preserved entry/MCP behavior. The endpoint intentionally returns null for optional unavailable content; provider success is verified separately below.
- **Live provider check passed** through the actual server endpoint and browser. The first quote attempt exposed a Cloudflare fetch limitation: `redirect: error` is unsupported. Using `manual` and accepting only successful responses resolved it, without following redirects.
- The quote displayed below the week card at desktop width and below the journal/supporting cards on a 390px phone. Tablet and desktop layouts were inspected, and the quote/source link stayed outside the entry controls.
- A synthetic entry was created, saved as Started and marked Filled while the quote remained visible. The same quote persisted through page reloads and layout previews.
- The ordinary local database received `0002_dizzy_leader.sql` and `0003_true_iron_fist.sql`: a separate quote-cache table scoped to the trusted identity. Existing user entries and phase settings were not modified. Provider lookups contain no journal/account data.

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

An initial built-server run returned a temporary 503 during a local Worker restart. The full unchanged integration assertions passed on the subsequent stable run. No assertion was weakened or given automatic retries.

## Local tooling and release boundary

`npm run dev:test` and `npm run start:test` use the dedicated QA database. Stop the development preview before built-server testing and avoid rebuilding while a built server is running. The macOS Codex sandbox uses file polling to avoid native watcher errors. Test requests drain response bodies, use fresh HTTP connections to avoid stale local Wrangler sockets, and retain eight-second timeouts. No assertion accepts a failure status as success.

The Site remains owner-private and unpublished pending preview review. The prior native access-policy check allowed only the owner, with no external visitors, groups or other editors. MCP behavior is verified locally; hosted sign-in and plugin installation still require first publication and a subsequent read-only smoke test.

Local databases, real records, exports, credentials, screenshots and QA harness files remain ignored by Git.
