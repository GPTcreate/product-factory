import { fetchWithRetry } from "./http.ts";
import { SyncError, codeForStatus, isRetryableStatus } from "./errors.ts";
import { ga4DateToIso, type Ga4Report } from "./normalize.ts";
import type { SupabaseClient } from "./database.ts";
import type { AnalyticsExtended, EventDaily } from "./product.ts";
interface DetailReport extends Ga4Report {
  dimensionHeaders?: { name: string }[];
  rowCount?: number;
}
function cell(
  report: DetailReport,
  row: NonNullable<DetailReport["rows"]>[number],
  key: string,
  dimension = false,
) {
  const headers = dimension ? report.dimensionHeaders : report.metricHeaders;
  const idx = headers?.findIndex((h) => h.name === key) ?? -1;
  const value = (dimension ? row.dimensionValues : row.metricValues)?.[idx]
    ?.value;
  if (idx < 0 || value === undefined)
    throw new Error(`Missing GA4 detail column: ${key}`);
  return value;
}
function numberCell(
  report: DetailReport,
  row: NonNullable<DetailReport["rows"]>[number],
  key: string,
) {
  const value = Number(cell(report, row, key));
  if (!Number.isFinite(value) || value < 0)
    throw new Error("Invalid GA4 detail metric");
  return value;
}
export function normalizeGa4Detail(
  engagement: DetailReport,
  returning: DetailReport,
  siteId: string,
  now: string,
): AnalyticsExtended[] {
  const returningByDate = new Map(
    (returning.rows ?? []).map((r) => [
      ga4DateToIso(cell(returning, r, "date", true)),
      numberCell(returning, r, "totalUsers"),
    ]),
  );
  return (engagement.rows ?? []).map((r) => {
    const date = ga4DateToIso(cell(engagement, r, "date", true));
    return {
      site_id: siteId,
      metric_date: date,
      new_users: numberCell(engagement, r, "newUsers"),
      returning_users: returningByDate.get(date) ?? 0,
      engagement_seconds: numberCell(engagement, r, "userEngagementDuration"),
      updated_at: now,
    };
  });
}
export function normalizeEvents(
  report: DetailReport,
  siteId: string,
  now: string,
): EventDaily[] {
  return (report.rows ?? []).map((r) => ({
    site_id: siteId,
    metric_date: ga4DateToIso(cell(report, r, "date", true)),
    event_name: cell(report, r, "eventName", true),
    event_count: numberCell(report, r, "eventCount"),
    updated_at: now,
  }));
}
export async function syncGa4Detail(
  admin: SupabaseClient,
  token: string,
  property: string,
  siteId: string,
  startDate: string,
  endDate: string,
) {
  async function report(
    dimensions: string[],
    metrics: string[],
    dimensionFilter?: unknown,
  ): Promise<DetailReport> {
    const res = await fetchWithRetry(
      `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(property)}:runReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: dimensions.map((name) => ({ name })),
          metrics: metrics.map((name) => ({ name })),
          dimensionFilter,
          limit: 100000,
        }),
      },
    );
    if (!res.ok)
      throw new SyncError(
        codeForStatus(res.status),
        `GA4 detail HTTP ${res.status}`,
        { status: res.status, retryable: isRetryableStatus(res.status) },
      );
    const data = (await res.json()) as DetailReport;
    if ((data.rowCount ?? 0) > (data.rows?.length ?? 0))
      throw new Error("GA4 detail truncated; reduce date range");
    return data;
  }
  const engagement = await report(
    ["date"],
    ["newUsers", "userEngagementDuration"],
  );
  const returning = await report(["date"], ["totalUsers"], {
    filter: {
      fieldName: "newVsReturning",
      stringFilter: { matchType: "EXACT", value: "returning" },
    },
  });
  const events = await report(["date", "eventName"], ["eventCount"]);
  const now = new Date().toISOString();
  const extended = normalizeGa4Detail(engagement, returning, siteId, now),
    eventRows = normalizeEvents(events, siteId, now);
  if (extended.length) {
    const { error } = await admin
      .from("analytics_extended_daily")
      .upsert(extended, { onConflict: "site_id,metric_date" });
    if (error) throw error;
  }
  if (eventRows.length) {
    const { error } = await admin
      .from("analytics_event_daily")
      .upsert(eventRows, { onConflict: "site_id,metric_date,event_name" });
    if (error) throw error;
  }

  return extended.length + eventRows.length;
}
