import type { AdSenseDaily } from "./product.ts";
import { validDate } from "./factory-input.ts";
// Verified against Google's v2 REST reference, 2026-10-04. See docs/ADSENSE.md.
export const ADSENSE_DIMENSION = "OWNED_SITE_DOMAIN_NAME";
export const ADSENSE_METRICS = [
  "ESTIMATED_EARNINGS",
  "IMPRESSIONS",
  "PAGE_VIEWS",
  "AD_REQUESTS",
  "MATCHED_AD_REQUESTS",
  "CLICKS",
  "PAGE_VIEWS_CTR",
  "PAGE_VIEWS_RPM",
  "AD_REQUESTS_COVERAGE",
] as const;
export interface AdSenseReport {
  headers?: { name: string; type?: string; currencyCode?: string }[];
  rows?: { cells: { value: string }[] }[];
  totalMatchedRows?: string;
  warnings?: string[];
}
export function adSenseReportUrl(
  account: string,
  mapping: string,
  start: string,
  end: string,
  currency: string,
) {
  if (!/^accounts\/pub-\d+$/.test(account))
    throw new Error("Invalid ADSENSE_ACCOUNT");
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(mapping))
    throw new Error("Invalid AdSense domain mapping");
  if (
    !validDate(start) ||
    !validDate(end) ||
    start > end ||
    !/^[A-Z]{3}$/.test(currency)
  )
    throw new Error("Invalid report parameters");
  const url = new URL(
    `https://adsense.googleapis.com/v2/${account}/reports:generate`,
  );
  url.searchParams.set("dateRange", "CUSTOM");
  for (const [name, date] of [
    ["startDate", start],
    ["endDate", end],
  ]) {
    const [year, month, day] = date.split("-").map(Number);
    for (const [part, value] of Object.entries({ year, month, day }))
      url.searchParams.set(`${name}.${part}`, String(value));
  }
  for (const d of ["DATE", ADSENSE_DIMENSION])
    url.searchParams.append("dimensions", d);
  for (const m of ADSENSE_METRICS) url.searchParams.append("metrics", m);
  url.searchParams.set("filters", `${ADSENSE_DIMENSION}==${mapping}`);
  url.searchParams.set("currencyCode", currency);
  url.searchParams.set("reportingTimeZone", "ACCOUNT_TIME_ZONE");
  url.searchParams.set("languageCode", "en");
  url.searchParams.set("orderBy", "+DATE");
  url.searchParams.set("limit", "100000");
  return url;
}
export function normalizeAdSense(
  report: AdSenseReport,
  productId: string,
  mapping: string,
  currency: string,
  syncedAt: string,
  start: string,
  end: string,
): AdSenseDaily[] {
  const rows = report.rows ?? [];
  if (
    report.totalMatchedRows !== undefined &&
    (!/^\d+$/.test(report.totalMatchedRows) ||
      BigInt(report.totalMatchedRows) > BigInt(rows.length))
  )
    throw new Error("AdSense report truncated or invalid; no rows written");
  if (!rows.length) return [];
  const headers = report.headers ?? [];
  const names = headers.map((h) => h.name);
  for (const required of ["DATE", ADSENSE_DIMENSION, ...ADSENSE_METRICS])
    if (!names.includes(required))
      throw new Error(`Missing AdSense header: ${required}`);
  if (new Set(names).size !== names.length)
    throw new Error("Duplicate AdSense headers");
  if (
    headers.find((h) => h.name === "ESTIMATED_EARNINGS")?.currencyCode !==
      currency ||
    headers.find((h) => h.name === "PAGE_VIEWS_RPM")?.currencyCode !== currency
  )
    throw new Error("Unexpected AdSense currency");
  const dates = new Set<string>();
  return rows.map((row) => {
    const get = (name: string) => row.cells[names.indexOf(name)]?.value;
    const num = (name: string) => {
      const raw = get(name);
      const n = Number(raw);
      if (raw === undefined || raw.trim() === "" || !Number.isFinite(n))
        throw new Error(`Invalid AdSense metric: ${name}`);
      return n;
    };
    const count = (name: string) => {
      const n = num(name);
      if (!Number.isSafeInteger(n) || n < 0)
        throw new Error(`Invalid count: ${name}`);
      return n;
    };
    const date = get("DATE");
    if (!validDate(date) || date < start || date > end || dates.has(date))
      throw new Error("Invalid or duplicate AdSense date");
    dates.add(date);
    if (get(ADSENSE_DIMENSION) !== mapping)
      throw new Error("AdSense attribution mismatch; no rows written");
    return {
      product_id: productId,
      metric_date: date,
      currency_code: currency,
      mapping_key: mapping,
      synced_at: syncedAt,
      estimated_earnings: num("ESTIMATED_EARNINGS"),
      impressions: count("IMPRESSIONS"),
      page_views: count("PAGE_VIEWS"),
      ad_requests: count("AD_REQUESTS"),
      matched_ad_requests: count("MATCHED_AD_REQUESTS"),
      clicks: count("CLICKS"),
      ctr: num("PAGE_VIEWS_CTR"),
      rpm: num("PAGE_VIEWS_RPM"),
      coverage: num("AD_REQUESTS_COVERAGE"),
    };
  });
}
