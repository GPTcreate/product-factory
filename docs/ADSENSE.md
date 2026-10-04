# AdSense integration contract

Verified against official Google documentation on 2026-10-04:

- [reports.generate](https://developers.google.com/adsense/management/reference/rest/v2/accounts.reports/generate)
- [Dimensions](https://developers.google.com/adsense/management/reference/rest/v2/Dimension)
- [Metrics](https://developers.google.com/adsense/management/reference/rest/v2/Metric)
- [ReportResult](https://developers.google.com/adsense/management/reference/rest/v2/ReportResult)
- [Filtering](https://developers.google.com/adsense/management/reporting/filtering)

## Authentication and request

Use OAuth scope `https://www.googleapis.com/auth/adsense.readonly`. The existing Google client / refresh-token path is reused; re-consent with GA4, Search Console and AdSense scopes together. Enabling the API does not add scopes to an old refresh token automatically. Do not use a Google API key or browser-held service account credential.

`GET https://adsense.googleapis.com/v2/accounts/pub-.../reports:generate`

Parameters use repeated `dimensions` and `metrics`, exact-match `filters`, `dateRange=CUSTOM`, `startDate.year/month/day`, `endDate.year/month/day`, `reportingTimeZone=ACCOUNT_TIME_ZONE`, and a fixed `currencyCode` (USD by default). Default refresh window is 14 completed days, using the existing upstream date helper. Near timezone boundaries the latest account-local day may not yet have data; absence remains No Data.

## Attribution

v0.1 uses `DATE` + `OWNED_SITE_DOMAIN_NAME`, filtering the latter exactly against `sites.adsense_mapping_key`. The operator must copy the **verified site domain reported in the real AdSense account**, rather than assume it is always the browser hostname. A database unique index prevents assigning one verified site to two products, including case variants. Every response row must match the configured mapping.

One verified domain per product is intentionally supported. Several independent products under one verified domain need a reviewed mapping extension before use; this version does not silently allocate revenue between them. `DOMAIN_NAME` is not assumed to represent the verified site. Account totals are never copied into each product.

Changing a mapping with historical revenue is blocked by a DB trigger. Preserving/moving historical attribution needs a reviewed data migration and user approval before any deletion. Disconnecting an integration preserves its existing history.

## Stored values

| API metric | Stored field |
| --- | --- |
| ESTIMATED_EARNINGS | estimated_earnings |
| IMPRESSIONS | impressions |
| PAGE_VIEWS | page_views |
| AD_REQUESTS | ad_requests |
| MATCHED_AD_REQUESTS | matched_ad_requests |
| CLICKS | clicks |
| PAGE_VIEWS_CTR | ctr |
| PAGE_VIEWS_RPM | rpm |
| AD_REQUESTS_COVERAGE | coverage |

Currency values remain in the reported currency units, not micros. Ratios remain fractional and are formatted as percentages in the UI. Period CTR = clicks / page views; period RPM = earnings / page views × 1000; coverage = matched requests / ad requests. Daily ratios are not averaged. Mixed currencies suppress combined earnings/RPM instead of adding incomparable amounts.

Header names are validated, rather than relying on column position. Currency, dates, attribution, numeric fields and duplicate dates are checked before any write. Truncated reports fail without writing. Provider warnings produce partial sync status. Empty reports produce no fabricated zero rows. Explicit rows with zero earnings remain zero.

## Lifecycle and limits

AdSense is registered in the existing shared adapter registry and `manual-sync` all-source flow. Scheduled function uses the existing automation secret. Retries use the upstream bounded retry helper; provider response bodies are not stored. Sync history, running-row conflict protection, failure streaks and stale detection are shared with GA4/GSC/Bing. Upsert key is `(product_id, metric_date)`.

A report warning is recorded as a count, not unsanitized provider text. Currency headers are checked against the configured currency. Earnings are estimates, not bank deposits or a financial settlement ledger. Days omitted by a later provider report do not delete old rows; investigate discrepancies in the provider console before corrective data changes.
