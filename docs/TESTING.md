# Validation and fixtures

Baseline: upstream commit `27b1c087d84fb86762cdc4eac31d7ec06cc9dea9` passed 127 Vitest tests, lint, TypeScript and production build before changes. The original privacy-context Fast Refresh warning and large-bundle warning were present in the baseline.

## Automated checks

- `npm test`: upstream regression tests plus Product/Idea validation, weighted opportunity scores, AdSense request contract, header-order independence, attribution mismatch, currency mismatch, report truncation, duplicate dates, zero/no-data separation and adapter fixture integration.
- `npm run test:db`: executes all 13 migration SQL files in PGlite (PostgreSQL), verifies CRUD, unique keys, upsert correction without duplication, integration reconciliation, historical attribution protection, cascading deletes on disposable fixtures, read denial for anon/non-admin/aal1, allowed reads for admin+aal2 and denial of browser writes. Hosted Auth helpers, Vault, pg_cron and pg_net are substitutes; network scheduling and real GoTrue MFA are outside this test.
- Deno checks the actual server entrypoints independently of the browser test type bridge.

## Browser test

```bash
npm ci
npx playwright install chromium
npm run test:browser
```

The script starts a local Vite fixture harness, intercepts the synthetic Supabase hostname, and exercises the real React pages. No live user credentials or provider calls are used. `tests/browser` is not referenced by the production `index.html` and is not included in the Vite output.

Coverage: P001 preset/create, AdSense settings, revenue rendering, Ideas create/edit/delete, weekly experiment save and pipeline status update. Screenshots are written to ignored `test-results/`. A separately supplied Chromium binary can be used with `PLAYWRIGHT_CHROMIUM_EXECUTABLE` when the standard download is unavailable.

The fixture backend does not substitute for an actual deployment acceptance test. Follow SETUP.md after connecting accounts.
