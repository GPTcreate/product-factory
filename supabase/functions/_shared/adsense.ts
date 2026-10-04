import { SyncError, codeForStatus, isRetryableStatus } from "./errors.ts";
import { fetchWithRetry } from "./http.ts";
import { getGoogleAccessToken } from "./google-auth.ts";
import { defaultRange } from "./range.ts";
import {
  adSenseReportUrl,
  normalizeAdSense,
  type AdSenseReport,
} from "./adsense-report.ts";
import type { SyncAdapter } from "./sync-run.ts";
export const adsenseAdapter: SyncAdapter = async ({
  admin,
  site,
  rangeStart,
  rangeEnd,
}) => {
  const account = Deno.env.get("ADSENSE_ACCOUNT");
  const currency = Deno.env.get("ADSENSE_CURRENCY_CODE") || "USD";
  if (!account || !site.adsense_enabled || !site.adsense_mapping_key)
    throw new SyncError(
      "config_missing",
      "AdSense account and product mapping are required",
    );
  const { startDate, endDate } =
    rangeStart && rangeEnd
      ? { startDate: rangeStart, endDate: rangeEnd }
      : defaultRange(14);
  const url = adSenseReportUrl(
    account,
    site.adsense_mapping_key,
    startDate,
    endDate,
    currency,
  );
  const token = await getGoogleAccessToken();
  const response = await fetchWithRetry(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok)
    throw new SyncError(
      codeForStatus(response.status),
      `AdSense API returned HTTP ${response.status}`,
      {
        status: response.status,
        retryable: isRetryableStatus(response.status),
      },
    );
  const report = (await response.json()) as AdSenseReport;
  const rows = normalizeAdSense(
    report,
    site.id,
    site.adsense_mapping_key,
    currency,
    new Date().toISOString(),
    startDate,
    endDate,
  );
  if (rows.length) {
    const { error } = await admin
      .from("adsense_daily_metrics")
      .upsert(rows, { onConflict: "product_id,metric_date" });
    if (error) throw error;
  }
  return {
    rowsFetched: report.rows?.length ?? 0,
    rowsWritten: rows.length,
    rangeStart: startDate,
    rangeEnd: endDate,
    partial: !!report.warnings?.length,
    metadata: {
      provider: "adsense",
      currency,
      dimension: "OWNED_SITE_DOMAIN_NAME",
      warningCount: report.warnings?.length ?? 0,
    },
  };
};
