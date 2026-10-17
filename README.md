# Fitness Journal

A private, mobile-first journal for daily observations. Record a workout (A–E or Rest), reported bedtime and wake-up, alcohol and optional quantity, junk food, and notes. Every field is optional. Browse days and weeks, edit or delete a day, configure an initial 16-week phase, and export CSV.

There are no scores, streaks, progress targets, or judgments about empty days. Bedtime and wake-up are **reported clock times**, never measured sleep. No sleep duration is stored or calculated.

## Source and hosting

The source lives in `/Users/mrinalsood/Developer/fitness-journal`, with GitHub at <https://github.com/Mon711/fitness-journal>. The tracked `.openai/hosting.json` identifies the ChatGPT Site. GitHub is your development repository; Sites also requires a platform source repository. Both receive **the same Git commit from this checkout**, not separate maintained versions. Never edit the Site elsewhere without first bringing those commits back into this checkout.

The Site is registered but must be published only after preview review. A saved Site version is not a deployment. Every URL returned by a Sites deployment operation is a production URL; it is not a staging environment. Use the local preview for review.

## How the application works

1. `app/page.tsx` requires ChatGPT sign-in before opening the journal. During development only, the Sites starter provides a synthetic loopback sign-in.
2. `app/journal.tsx` is the React interface. React updates the visible form when you select a different day or observation. Native date and time controls use the phone/browser's own pickers.
3. `app/api/entries/route.ts` and `app/api/phase/route.ts` accept browser requests. An API is the server interface the page uses to read or change records. Each route verifies identity; writes also check the request originated from this journal.
4. `lib/storage.ts` reads and writes Cloudflare D1, a persistent SQL database hosted with the Site. Every query includes the trusted user's Site-scoped ID. A user can have one entry per date. Saving the same day updates it; changing the date selector opens that day's record rather than moving an existing record.
5. `app/mcp/route.ts` provides three read-only tools over the **same storage functions and database**. MCP is the protocol ChatGPT uses to call those tools. It cannot write or delete entries.
6. `db/schema.ts` describes database tables. `drizzle/` contains the generated SQL migrations, which are versioned instructions for creating/changing those tables. Sites applies these to hosted D1 at publication. Requests never create tables.

`lib/journal.ts` contains shared validation, date numbering and CSV formatting. `lib/http.ts` contains request authorization and safe error responses. `app/globals.css` handles the responsive layout. The Sites starter's `build/`, `scripts/` and Vite integration remain part of the supported hosting pipeline.

## Daily entry states

- **Not recorded**: no saved entry and no observations entered.
- **Started · Unsaved**: selecting a workout or changing another value immediately updates the label beside the date. These changes are not durable until you save; the existing navigation warning protects against accidental loss.
- **Started**: `Save entry` / `Save changes` stores the current details without declaring that the day is finished.
- **Filled**: `Mark day as filled` saves the current details and your explicit confirmation. Optional fields can remain unrecorded; the app never guesses completeness from the number of answered fields.

After saving, the date and surrounding page remain visible, with a read-only summary instead of editable choices. Choose **Edit entry** to make changes. Edits preserve an existing Filled confirmation; **Mark as started again** explicitly removes that confirmation without removing observations. History and the week strip show the same state.

`entries.filled` stores this boolean (true/false) flag. Migration `0001_dapper_deadpool.sql` adds it with a false default, preserving all existing records as Started. `lib/storage.ts` converts SQLite's 0/1 storage into a boolean for the browser and MCP. CSV includes the flag as its last column. No automatic scoring, completeness percentage or mandatory fields are introduced.

## Privacy and time conventions

- Keep the Site's audience owner-only. Sites authenticates visitors and MCP callers and supplies trusted identity headers; the app rejects requests with missing identity. Other identities cannot read or modify your rows, even if the Site audience changes accidentally.
- No credentials, real records, local database files or exports belong in Git. `.gitignore` excludes them. The app does not use localStorage for journal records.
- The date is a local calendar date, initially selected from your device. Wake-up belongs to that date. Bedtime can refer to the previous date or the entry date (for example, 00:40 after midnight). No time-zone conversion is applied to these approximate clock observations. `updatedAt` is a separate UTC audit timestamp.
- `null` means not recorded. It is distinct from `no` and `Rest`. Missing days are not stored as artificial negative records.
- Phase numbering begins at Day 1 / Week 1 on your configured start date. The journal begins on 17 October 2026 by default. Earlier dates are excluded from history and entry navigation; the first week begins on that date. A later configured phase start also limits visible history, without deleting stored records. Dates after the phase remain recordable. Updating phase settings never removes entries.
- CSV exports all your recorded dates, including dates outside the phase. Blank values remain blank. Formula-like text is prefixed with an apostrophe for spreadsheet safety. CSV backups are downloadable; CSV import is outside version 1.
- Deletion is permanent for that day's entry; export a backup first if needed.

## Run locally

Run all commands below from `/Users/mrinalsood/Developer/fitness-journal`. Node.js 22.13 or newer is required. The examples use `rtk`, your terminal output helper; omit that prefix on a machine without it.

### 1. Install dependencies

```sh
rtk npm ci
```

This installs the exact versions in `package-lock.json` into `node_modules`; it does not deploy. If your shared npm cache has permissions problems, use a project-local cache instead:

```sh
rtk proxy env npm_config_cache="$PWD/.sites-runtime/npm-cache" npm ci
```

This changes only local dependency/cache files. A successful install exits without an error.

### 2. Build and create the local database

```sh
rtk npm run build
rtk proxy node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_large_spitfire.sql
rtk proxy node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_dapper_deadpool.sql
```

The build produces `dist/`, including the Worker configuration. A Worker is the server program Sites runs to handle requests. The database commands apply both migrations **once, in order, to a new local database**. `--local` prevents hosted database access; `--persist-to` selects ignored development state. Expect two table creation statements and then one statement adding the Filled field. If you already have the original tables, apply only `0001_dapper_deadpool.sql`. Do not replay applied migrations. This checkout already has both migrations applied, with its existing entry preserved.

For future schema changes, update `db/schema.ts`, run `rtk npm run db:generate`, inspect the new SQL and metadata, rebuild, then apply **only pending new SQL files** locally in order using the same command with the new filename. Commit migrations. Never modify already-applied migration files. Hosted migrations are handled by Sites; do not add `--remote` to local test commands.

### 3. Open the development preview

```sh
rtk npm run dev -- --hostname 127.0.0.1
```

This starts the development server on loopback (this Mac only), usually <http://127.0.0.1:5173>. It does not publish. The sign-in redirect uses a synthetic `local_seedy` account, not your production records. `Ctrl+C` stops the server. Your local synthetic records persist in ignored `.wrangler/state`.

## Test before every release

```sh
rtk npm test
rtk npm run typecheck
rtk npm run build
```

These check domain behavior, TypeScript consistency, and production compilation. TypeScript checks that the code uses compatible data types. All commands must exit successfully. They do not touch hosted data.

Use the separate synthetic QA database for all tests, even if the ordinary local preview contains your own entries. For a fresh checkout, initialize it once by applying each SQL file in `drizzle/` in order with the migration commands above, replacing `--persist-to .wrangler/state` with `--persist-to .sites-runtime/qa-state`. This checkout's QA database is initialized. Never copy real records into it.

For actual browser testing, run `rtk npm run dev:test`. This starts a loopback preview at <http://127.0.0.1:5175> using `.sites-runtime/qa-state`, separate from your normal preview's data. The `FITNESS_QA` switch is read only by development tooling, never as a hosted authentication bypass.

Stop that preview before testing the built server:

```sh
rtk npm run start:test
```

This runs the production build **locally**, bound to 127.0.0.1. It uses only the separate synthetic QA database and does not simulate browser sign-in. Wait until Wrangler reports readiness. Stop the development preview before running built-server tests, and avoid rebuilding while the built server runs. In the macOS Codex sandbox, the local environment helper selects file polling to avoid unsupported native filesystem watchers. Then run:

```sh
rtk npm run test:api
```

The integration tests use only `http://127.0.0.1:8787`, disposable `synthetic-test-*` identities and a 2091 sample date. Tests check CRUD (create, read, update and delete), access denial, two-user isolation, CSV and the actual MCP endpoint. They delete their own test entries afterward; synthetic phase metadata may remain in the local database. Production authentication is provided by Sites, so these tests simulate its trusted headers only against the loopback built server. Never expose that server to a network or substitute a production URL.

Also use the actual isolated QA UI: configure a phase, create an entry, set both clock times, switch bedtime date, save, reopen in Journal, save a partial entry, mark it Filled, reload, edit, reopen as Started, export CSV, and delete. Inspect widths around 390, 768 and 1440 pixels, keyboard focus, and unsaved-change prompts. Use synthetic values only. See TESTING.md for the last verified results.

## Prepare and publish through Sites

Use Codex with the installed Sites plugin for native registration, credentials, saved versions and deployment. No account credentials belong in scripts or environment examples. The Site already exists; reuse `project_id` from `.openai/hosting.json`.

The supported helper root on this Mac is:

`/Users/mrinalsood/.codex/plugins/cache/openai-curated-remote/sites/1.0.1`

If the installed plugin version moves, resolve the current Sites skill path instead of assuming this cache path stays fixed.

1. Implement locally, run the checks above, and finish browser testing. Review `git diff` for secrets and data. Commit the tested changes and push `main` to GitHub. `git push origin main` publishes source code, not records or a Site deployment.
2. Obtain a short-lived source write credential for the existing Site through the native Sites tool. Do **not** request publish-on-push while preparing a preview.
3. Run `node <plugin-root>/scripts/site-workflow.mjs --project-id <existing-project-id>` in a retained terminal session. After its hidden-stdin prompt, provide the credential in a single JSON object through stdin, with `commands` containing any remaining checks followed by `["node", "<plugin-root>/scripts/build-site.mjs"]`, and `archivePath` pointing to an ignored absolute `.tar.gz` file. Never put the token in arguments, a file, logs or shell history. The helper validates source ancestry, pushes the exact commit to Sites and packages build output.
4. Verify the helper's `commit_sha` equals local `HEAD` and GitHub `main`. If the helper committed build-related tracked changes, push that same SHA to GitHub before saving. Do not force-push on divergence; reconcile and retest.
5. Call the native `save_site_version` with the helper's exact project ID, commit SHA and archive path. This prepares a reviewable saved version **without publishing**. Present the local preview for user review.
6. After review approval, deploy that already-saved version using `deploy_private_site_version`. Preserve owner-only access. Do not save/upload it again. Wait for terminal success and record the deployment's version and source commit. If a new edit is needed, restart at step 1.

No GitHub-only auto-deployment is configured. Keeping both source remotes at the same commit is an explicit release step; the deployment artifact is built from that commit. Do not upload `.wrangler/`, `.sites-runtime/`, `.env*`, CSV files or local test records. Follow this workflow for future iterations too.

## ChatGPT MCP connection

The manifest declares `capabilities: ["mcp"]`. `POST /mcp` supports discovery and exposes:

| Tool          | Input                          | Result                                                   |
| ------------- | ------------------------------ | -------------------------------------------------------- |
| `get_entry`   | `date` in YYYY-MM-DD           | One recorded entry, or null                              |
| `get_entries` | inclusive `start`, `end` dates | Recorded entries, oldest first                           |
| `get_phase`   | no arguments                   | Starting date, weeks, title, and interpretation metadata |

All tools require the caller's trusted identity and are marked read-only. Sleep and missing-entry semantics are included in tool descriptions/metadata.

Publishing with MCP enabled causes Sites to create/update its private App and plugin. A saved, unpublished version does not activate the connection. After first publication, inspect the Site with `include_mcp_connection: true`; reuse the returned plugin, then install/connect it through the native plugin UI if it is not already available. No separate custom plugin, local MCP config, or OAuth credentials are needed. Verify a read-only call after connection. Local MCP checks pass, but hosted installation and authentication can only be verified after publishing.

## Version 1 boundaries

No wearable integrations, analytics, import, automatic backups, offline queue or real-time cross-tab synchronization. Connectivity is required to save. Unsaved form changes trigger a navigation warning; save failures preserve the visible form. Data is private to the signed-in user; keep the hosted Site owner-only. This is an observation journal, not medical advice.
