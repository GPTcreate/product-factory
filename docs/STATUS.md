# Product Factory v0.1 — implementation checkpoint

## Completed locally

- Four supplied documents read in the requested order; requirements retained in this docs directory.
- Authenticated GitHub identity verified as `GPTcreate` / `hanmanju88@gmail.com`.
- Upstream cloned with MIT attribution preserved; baseline commit recorded in README.
- Product registry/UI, P001 preset, Ideas CRUD and weighted scoring, weekly experiments/pipeline, business/revenue overview implemented.
- AdSense adapter integrated into existing manual/scheduled sync lifecycle; verified-domain attribution, currency safety, idempotent daily storage and MFA/admin RLS implemented.
- GA4 audience/engagement and common/custom event reports, GSC country/device breakdowns added. Original integrations, uptime, search ranking, anomaly/forecast and exports retained.
- Browser missing-data states distinguish Not Connected / No Data / measured zero in portfolio KPI and revenue views.
- Cloudflare Pages setup, environment variable templates, Supabase migration and provider setup instructions prepared.

## Validation evidence

| Check | Result |
| --- | --- |
| Upstream baseline | 127 tests passed; lint/typecheck/build passed |
| Extended Vitest suite | 151 tests passed |
| Frontend TypeScript | Passed |
| ESLint | 0 errors; 1 existing Fast Refresh warning |
| Vite production build | Passed; existing >500 kB chunk warning remains |
| Formatting | Passed |
| Deno server entrypoints | manage-sites, manage-factory, manual-sync, scheduled-sync-adsense checked successfully |
| Migration/RLS execution | 13 migration files executed in embedded PostgreSQL; Auth/Vault/cron/net stand-ins |
| Database behavior | Product/Ideas CRUD, weekly records, uniqueness, revenue upsert, attribution guard, cascade behavior and role/MFA restrictions passed |
| AdSense fixture integration | OAuth response → report normalization → repeated upsert passed; no real credentials |
| Browser interaction | P001 create; AdSense setting and revenue; idea create/edit/delete; week save; product status change; desktop/mobile screenshots; no page errors |

Browser testing used disposable synthetic data and a test harness that is excluded from the production build. It does not prove real provider access, actual GoTrue MFA enrollment or hosted scheduler execution. The normal Chromium download endpoint returned invalid archives in this environment; an npm-distributed Chromium binary was used for the same Playwright checks.

## Still pending — not claimed as deployed or live

1. GitHub fork and push: the connected GitHub tool exposes identity/read/commit operations, but no repository/fork creation. Browser fallback needs user approval. No write was made to upstream or another GitHub account.
2. Supabase project selection/creation, hosted migrations, admin allowlist and first TOTP enrollment.
3. Google/AdSense OAuth and Bing credentials, then live P001 data reconciliation.
4. Cloudflare account connection, build-time environment settings, deployment and live auth/CORS/SPA smoke tests.
5. Confirm one scheduled run per provider in the real project, including 04:30 UTC AdSense job.

## Operating limits

- Single admin and one AdSense account, one verified domain mapping per product. Shared-domain product splits require a reviewed extension.
- Historical mapping changes are blocked to prevent mixing revenue. No operational data was deleted during this work.
- Revenue uses the configured reporting currency; mixed stored currencies suppress combined earnings/RPM.
- Daily user totals are sums, not deduplicated period users. Search/GA4/AdSense provider timezones may differ.
- Reports may arrive late or be partial. Missing response rows never imply zero. Omitted dates do not automatically erase previously stored data.
- Extra analytics/event/search-audience and business tables have no automatic retention deletion yet. Monitor storage before connecting the full portfolio.
- HOLD/KILL is a product status. Disable Active separately when scheduled collection/uptime should stop.
- SQL migration tests validate PostgreSQL behavior with infrastructure stand-ins; a real Supabase acceptance test is still necessary.
- Original unit coverage is retained, but live GA4/GSC/Bing/uptime/ranking/export behavior still needs the connected deployment smoke test.

## Key changed files

- `src/features/factory/*`: Ideas, Factory, business overview, revenue and analytics detail UI/data access.
- `src/features/sites/*`, `src/features/dashboard/*`, `src/app/router.tsx`, `src/components/layout/AppLayout.tsx`: product forms, routes and existing view integration.
- `supabase/functions/_shared/{product,factory-input,adsense-report,adsense,ga4-detail}.ts`: contracts, server validation and adapters.
- `supabase/functions/manage-factory/index.ts`, `scheduled-sync-adsense/index.ts`, shared registry/manual sync: authenticated writes and synchronization.
- `supabase/migrations/0011_*`, `0012_*`, `0013_*`: additive schema, scheduler and RLS.
- `src/test/factory.test.ts`, `scripts/test-db.mjs`, `scripts/test-browser.mjs`: contract, adapter, DB and browser regression tests.
- `README.md`, `docs/{SETUP,ADSENSE,TESTING,STATUS}.md`, `.env.example`, `supabase/.env.example`: handoff and setup.

## Next authorized implementation step after approval

Use the verified `GPTcreate` account to fork `jafforgehq/site-analytics-tool`, restore/push the prepared implementation branch, then request only the necessary Supabase/Google/Cloudflare account approvals as those steps are reached. The user should not need to clone or prepare a repository manually.
