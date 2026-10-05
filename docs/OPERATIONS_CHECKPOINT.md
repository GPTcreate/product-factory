# Live operations checkpoint — 2026-10-05

This document distinguishes observed production state from prepared code and unresolved provider setup. No secret values belong here.

## Confirmed live

- GitHub: `GPTcreate/product-factory`, default branch `main`; fork/upstream `jafforgehq/site-analytics-tool`; MIT and original attribution preserved.
- Application release: `200ad5a5d37efb0f969e0a6999479d1e23306e42`, Cloudflare Pages check successful at 00:20:13 UTC.
- Production: https://product-factory-1ov.pages.dev/ ; Cloud Browser renders `/login`.
- Supabase project `nemkjxdxswwtrlufcykp`: dashboard showed Healthy, Free/Nano, Seoul; latest migration `analytics_detail`.
- P001 **IPOScore** was inserted into the actual `public.sites` registry through the authenticated project SQL Editor: domain `iposcore.kr`, URL `https://iposcore.kr/`, Korea, ko, Level 1, version 1.0, LIVE, active. Launch date and source repository remain unspecified.
- Post-write SQL verified all four P001 integration rows exist, with `enabled=false` and `last_success_at=NULL`.
- A fresh live check of all nine deployed functions returned HTTP 401 for unauthenticated POST requests. This verifies rejection only, not successful authorized sync.

## Real collection evidence

At the initial live SQL check, products and integration rows were empty; `sync_runs`, `uptime_checks`, and `adsense_daily_metrics` each contained 0 rows. P001 was subsequently registered, but no provider sync or uptime job was invoked.

An independent public HTTP request to https://iposcore.kr/ returned 200. A timed probe begun at 00:33:46 UTC also returned 200 after 11,767 ms. This is an external availability observation, **not a persisted dashboard metric or scheduler success**. One slow request does not establish typical site latency; the scheduled probe has a 10-second timeout.

The public homepage HTML contained an AdSense publisher identifier and a Google site-verification tag. No GA4 measurement ID or GTM ID was found in that fetched HTML; this does not rule out a dynamically loaded tag. None of these observations proves account ownership, property access, AdSense site approval, or API authorization.

## Provider TODOs

| Provider | Confirmed registry state | Required before enabling |
| --- | --- | --- |
| GA4 | Property ID NULL; disabled | Authorized Google account; real numeric GA4 property ID; Analytics Data API; readonly OAuth grant; first successful report |
| Search Console | Property NULL; disabled | Authorized Google account; exact verified property from its property list; Search Console API; readonly OAuth grant; first successful report |
| Bing | Site URL NULL; disabled | Bing account access; verified site URL; Webmaster API key stored server-side; first successful report |
| AdSense | Disabled; mapping NULL | Eligible account and verified site from the real AdSense account; AdSense Management API; readonly OAuth grant; account resource and domain mapping; report reconciliation |

Do not substitute GA4 measurement IDs for numeric property IDs, assume `sc-domain:iposcore.kr` exists, or enable AdSense based on a public ad tag.

## Automatic sync

The live `cron.job` query returned:

| Job | Schedule UTC | KST | Active |
| --- | --- | --- | --- |
| site-analytics-sync-gsc | 0 4 * * * | Daily 13:00 | false |
| site-analytics-sync-ga4 | 10 4 * * * | Daily 13:10 | false |
| site-analytics-sync-bing | 20 4 * * * | Daily 13:20 | false |
| product-factory-sync-adsense | 30 4 * * * | Daily 13:30 | false |
| site-analytics-uptime | 45 * * * * | Every hour :45 | false |
| site-analytics-cleanup | 30 3 * * 0 | Sunday 12:30 | true (pre-existing) |

Vault contained only the name `project_url`; `automation_secret` was absent. Secret contents were not queried. Edge secret names could not be freshly inspected after the browser protection block; do not infer their current values or presence.

The new work did not activate jobs, delete data, change RLS/MFA, or create credentials. Before activation:

1. Establish authorized provider access and store server-only credentials.
2. Generate a high-entropy automation secret and store the same value as Edge `AUTOMATION_SECRET` and Vault `automation_secret`; never expose it in output or source.
3. Verify missing/wrong automation keys are rejected, then one valid invocation succeeds.
4. Enable only a provider whose configuration and first sync have succeeded; leave unavailable providers disabled.
5. Observe an actual scheduled execution plus stored rows/last_success_at. Sending a cron request alone is not proof of successful collection.
6. Account for the existing scheduled-uptime retention delete before activation; do not perform unapproved data deletion.

## Consolidated human prerequisites

- Direct Supabase connector authorization for this project can avoid the Cloud Browser credential-protection limitation for database/function operations.
- Google sign-in and explicit readonly OAuth consent for GA4, Search Console, and AdSense. Where account eligibility prevents AdSense, continue GA4/GSC and leave AdSense as TODO. Do not request passwords or refresh tokens in chat.
- Bing sign-in and its API credential step through the provider/secure settings flow, never chat.
- Authorize creation/storage of the dedicated automation credential if the chosen setup flow requires a security-sensitive approval. No public sharing or weakened authentication is needed.

## Known Issues and completion gate

- Cloud Browser sign-in shows a network/service-reachability error; native credential protection also prevents some provider console observations. Keep this separate from account password validity.
- Google Cloud and Bing console navigation could not be inspected in this run. Their account/resource/consent state is unverified, not confirmed absent.
- Real provider reports, correct-key automated invocation, timed scheduler success, and Cloud Browser administrator/MFA access are not verified.
- v0.1 is deployed and P001 is registered, but **operational integration acceptance is incomplete**.
