import { useAnalyticsDetail } from "./api";
import { metricState } from "./model";
import { usePrivacyMode } from "@/lib/privacy";
import { ErrorState } from "@/components/ui/error-state";
import type { SiteWithStatuses } from "@/lib/api";
export function AnalyticsDetail({
  site,
  days,
  section,
}: {
  site: SiteWithStatuses;
  days: number;
  section: "traffic" | "events" | "search";
}) {
  const query = useAnalyticsDetail(site.id, days),
    privacy = usePrivacyMode();
  if (query.isLoading) return <p>Loading details…</p>;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  const data = query.data!;
  const display = (text: string) => (privacy.enabled ? "********" : text);
  if (section === "traffic")
    return (
      <section className="factory-panel">
        <h2 className="font-semibold">Audience & engagement</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            [
              "New users (daily sum)",
              data.audience.reduce((s, r) => s + r.new_users, 0),
            ],
            [
              "Returning users (daily sum)",
              data.audience.reduce((s, r) => s + r.returning_users, 0),
            ],
            [
              "Engagement seconds",
              data.audience.reduce(
                (s, r) => s + Number(r.engagement_seconds),
                0,
              ),
            ],
          ].map(([label, n]) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-semibold">
                {display(
                  metricState(
                    !!site.ga4_property_id,
                    !!data.audience.length,
                    Number(n).toLocaleString(),
                  ),
                )}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Daily users are summed across dates, not deduplicated period users.
          Returning users use GA4 newVsReturning = returning; they are not
          calculated by subtraction.
        </p>
      </section>
    );
  if (section === "events") {
    const counts = new Map<string, number>();
    data.events.forEach((r) =>
      counts.set(r.event_name, (counts.get(r.event_name) ?? 0) + r.event_count),
    );
    const names = [
      ...new Set([
        "core_action",
        "result_view",
        "share",
        "outbound_click",
        "signup",
        "premium_view",
        "checkout_start",
        "purchase",
        ...counts.keys(),
      ]),
    ];
    return (
      <section className="factory-panel">
        <h2 className="font-semibold">Events · {days} days</h2>
        <p className="my-2 text-sm text-muted-foreground">
          Common events and product-specific events received from GA4.
        </p>
        <table className="factory-table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {names.map((name) => (
              <tr key={name}>
                <td>{name}</td>
                <td>
                  {display(
                    metricState(
                      !!site.ga4_property_id,
                      counts.has(name),
                      String(counts.get(name)),
                    ),
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {(["country", "device"] as const).map((d) => {
        const grouped = new Map<
          string,
          { clicks: number; impressions: number; position: number }
        >();
        data.search
          .filter((r) => r.dimension === d)
          .forEach((r) => {
            const row = grouped.get(r.value) ?? {
              clicks: 0,
              impressions: 0,
              position: 0,
            };
            row.clicks += r.clicks;
            row.impressions += r.impressions;
            row.position += (r.average_position ?? 0) * r.impressions;
            grouped.set(r.value, row);
          });
        return (
          <section key={d} className="factory-panel overflow-x-auto">
            <h2 className="mb-3 font-semibold">Google Search · {d}</h2>
            {!grouped.size ? (
              <p>{site.gsc_property ? "No Data" : "Not Connected"}</p>
            ) : (
              <table className="factory-table">
                <thead>
                  <tr>
                    <th>{d}</th>
                    <th>Clicks</th>
                    <th>Impressions</th>
                    <th>CTR</th>
                    <th>Position</th>
                  </tr>
                </thead>
                <tbody>
                  {[...grouped]
                    .sort((a, b) => b[1].clicks - a[1].clicks)
                    .slice(0, 50)
                    .map(([value, r]) => (
                      <tr key={value}>
                        <td>{value}</td>
                        <td>{display(String(r.clicks))}</td>
                        <td>{display(String(r.impressions))}</td>
                        <td>
                          {display(
                            r.impressions
                              ? ((r.clicks / r.impressions) * 100).toFixed(2) +
                                  "%"
                              : "—",
                          )}
                        </td>
                        <td>
                          {display(
                            r.impressions
                              ? (r.position / r.impressions).toFixed(1)
                              : "—",
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </div>
  );
}
