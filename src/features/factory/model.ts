import type { AdSenseDaily } from "../../../supabase/functions/_shared/product";
export function revenueSummary(rows: AdSenseDaily[]) {
  const currencies = [...new Set(rows.map((r) => r.currency_code))];
  const sum = (
    key:
      | "estimated_earnings"
      | "page_views"
      | "impressions"
      | "ad_requests"
      | "matched_ad_requests"
      | "clicks",
  ) => rows.reduce((s, r) => s + Number(r[key]), 0);
  const earnings = sum("estimated_earnings"),
    views = sum("page_views"),
    requests = sum("ad_requests"),
    clicks = sum("clicks");
  return {
    hasData: !!rows.length,
    mixedCurrency: currencies.length > 1,
    currency: currencies[0] ?? null,
    earnings: currencies.length === 1 ? earnings : null,
    views,
    requests,
    clicks,
    impressions: sum("impressions"),
    rpm: views && currencies.length === 1 ? (earnings / views) * 1000 : null,
    ctr: views ? clicks / views : null,
    coverage: requests ? sum("matched_ad_requests") / requests : null,
  };
}
export function money(value: number | null, currency: string | null) {
  return value === null || !currency
    ? "No Data"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(value);
}
export function metricState(
  connected: boolean,
  hasRows: boolean,
  value: string,
) {
  return !connected ? "Not Connected" : !hasRows ? "No Data" : value;
}
export function seoulDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function monday(date = seoulDate()) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function isoWeek(date = seoulDate()) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return Math.ceil(
    ((+d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7,
  );
}
export function dataAvailability(
  products: import("@/lib/api").SiteWithStatuses[],
  raw: {
    analytics: { site_id: string; metric_date: string }[];
    search: { site_id: string; metric_date: string }[];
  },
  days: number,
) {
  const since = new Date(Date.now() - days * 86400000)
    .toISOString()
    .slice(0, 10);
  const state = (items: typeof products) => {
    const ids = new Set(items.map((p) => p.id));
    const ga4 = raw.analytics.some(
      (r) => ids.has(r.site_id) && r.metric_date >= since,
    )
      ? undefined
      : items.some((p) => p.ga4_property_id)
        ? "No Data"
        : "Not Connected";
    const search = raw.search.some(
      (r) => ids.has(r.site_id) && r.metric_date >= since,
    )
      ? undefined
      : items.some((p) => p.gsc_property || p.bing_site_url)
        ? "No Data"
        : "Not Connected";
    return { ga4, search };
  };
  return {
    portfolio: state(products.filter((p) => p.is_active)),
    products: Object.fromEntries(products.map((p) => [p.id, state([p])])),
  };
}
