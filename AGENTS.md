# Fitness Journal development rules

- This checkout and `Mon711/fitness-journal` are the authoritative source. Keep Sites source and GitHub on the same commit; never force-push to resolve divergence.
- Read README.md before changing hosting, authentication, storage or publishing.
- Keep the Site owner-private. Every browser API and MCP request must require trusted Sites identity. Scope every SQL read, update and delete to that identity. Never add a client-supplied owner selector.
- This is an observation journal. Do not introduce scores, streaks, goals, missed-day judgments or sleep duration estimates. Missing values remain null, distinct from No and Rest.
- Test locally with synthetic data before each live change. Never seed, reset, insert test data into, or run destructive tests against hosted D1. `tests/api.test.mjs` intentionally targets loopback only.
- Before preparing a version: run unit tests, TypeScript, production build, built API/MCP tests, and actual browser UI checks at phone/tablet/desktop widths. Document results in TESTING.md.
- Push tested source to GitHub and Sites, verify equal SHAs, then save the matching artifact. Provide a local preview for review before publishing production. Sites deployment URLs are production, not staging.
- Keep credentials in session memory and stdin only. Ignore local databases, CSV exports, .env files, tool state and test artifacts. Never commit real records.
- Explain changes, their purpose, assumptions, and verification in beginner-friendly language.
