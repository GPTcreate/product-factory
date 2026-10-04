import { useRevenue } from "./api";
import { revenueSummary, money, metricState } from "./model";
import { usePrivacyMode } from "@/lib/privacy";
import { ErrorState } from "@/components/ui/error-state";
import type { SiteWithStatuses } from "@/lib/api";
export function RevenuePanel({
  days,
  products,
  productId,
}: {
  days: number;
  products: SiteWithStatuses[];
  productId?: string;
}) {
  const query = useRevenue(days, productId),
    privacy = usePrivacyMode();
  if (query.isLoading)
    return <section className="factory-panel">Loading revenue…</section>;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  const rows = query.data ?? [],
    summary = revenueSummary(rows);
  const connected = products.some(
    (p) => p.adsense_enabled && p.adsense_mapping_key,
  );
  const display = (v: string) => (privacy.enabled ? "********" : v);
  const rankings = products
    .map((p) => ({
      p,
      s: revenueSummary(rows.filter((r) => r.product_id === p.id)),
    }))
    .sort((a, b) => (b.s.earnings ?? -Infinity) - (a.s.earnings ?? -Infinity));
  return (
    <section className="factory-panel space-y-4" id="revenue">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Ad revenue · last {days} days</h2>
        <span className="text-xs text-muted-foreground">
          Estimated earnings · AdSense account timezone
        </span>
      </div>
      {summary.mixedCurrency && (
        <p role="alert" className="text-critical">
          Multiple currencies detected. Combined earnings and RPM are
          unavailable.
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          [
            "Earnings",
            metricState(
              connected || rows.length > 0,
              summary.hasData,
              money(summary.earnings, summary.currency),
            ),
          ],
          [
            "Page RPM",
            summary.rpm === null
              ? "No Data"
              : money(summary.rpm, summary.currency),
          ],
          [
            "Ad clicks",
            metricState(
              connected || rows.length > 0,
              summary.hasData,
              String(summary.clicks),
            ),
          ],
          [
            "Ad impressions",
            metricState(
              connected || rows.length > 0,
              summary.hasData,
              summary.impressions.toLocaleString(),
            ),
          ],
        ].map(([label, v]) => (
          <div key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold">
              {display(!connected && !rows.length ? "Not Connected" : v)}
            </p>
          </div>
        ))}
      </div>
      {!connected && !rows.length && (
        <p className="text-sm text-muted-foreground">
          Add the verified AdSense site domain in product settings, then connect
          OAuth and run a sync.
        </p>
      )}
      {connected && !rows.length && (
        <p className="text-sm text-muted-foreground">
          No stored report rows yet. Check sync history; this does not mean zero
          revenue.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="factory-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Earnings</th>
              <th>Page views</th>
              <th>Clicks</th>
              <th>Page CTR</th>
              <th>Page RPM</th>
              <th>Coverage</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map(({ p, s }) => (
              <tr key={p.id}>
                <td>
                  {privacy.maskText(`${p.product_code ?? ""} ${p.name}`)}
                  {!p.adsense_enabled && s.hasData && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      Historical · disconnected
                    </span>
                  )}
                </td>
                <td>
                  {display(
                    metricState(
                      !!p.adsense_enabled || s.hasData,
                      s.hasData,
                      money(s.earnings, s.currency),
                    ),
                  )}
                </td>
                <td>{display(s.hasData ? s.views.toLocaleString() : "—")}</td>
                <td>{display(s.hasData ? String(s.clicks) : "—")}</td>
                <td>
                  {display(
                    s.ctr === null ? "—" : (s.ctr * 100).toFixed(2) + "%",
                  )}
                </td>
                <td>
                  {display(s.rpm === null ? "—" : money(s.rpm, s.currency))}
                </td>
                <td>
                  {display(
                    s.coverage === null
                      ? "—"
                      : (s.coverage * 100).toFixed(1) + "%",
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {productId && rows.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-primary">
            Daily report ({rows.length} days)
          </summary>
          <div className="mt-3 max-h-80 overflow-auto">
            <table className="factory-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Earnings</th>
                  <th>Views</th>
                  <th>Clicks</th>
                  <th>Ad requests</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((r) => (
                  <tr key={r.metric_date}>
                    <td>{r.metric_date}</td>
                    <td>
                      {display(money(r.estimated_earnings, r.currency_code))}
                    </td>
                    <td>{display(String(r.page_views))}</td>
                    <td>{display(String(r.clicks))}</td>
                    <td>{display(String(r.ad_requests))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <p className="text-xs text-muted-foreground">
        CTR = clicks / AdSense page views. RPM and coverage are recomputed from
        totals. Last stored date: {rows.at(-1)?.metric_date ?? "No Data"}.
      </p>
    </section>
  );
}
