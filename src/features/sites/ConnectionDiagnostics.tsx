import { Link } from "react-router-dom";
import { useRevenue } from "@/features/factory/api";
import { useSiteMetrics, useSyncRuns } from "@/lib/hooks";
import type { SiteWithStatuses } from "@/lib/api";
import {
  diagnoseConnection,
  type Observation,
} from "@/lib/connection-diagnostics";
import { SOURCES, SOURCE_LABEL } from "@/lib/sources";
import type { SyncSource } from "@/types/database";
import { usePrivacyMode } from "@/lib/privacy";
import { relativeTime } from "@/lib/dates";
import { connectionObservations } from "@/lib/connection-observations";

export function ConnectionDiagnostics({
  site,
  days,
}: {
  site: SiteWithStatuses;
  days: number;
}) {
  const metrics = useSiteMetrics(site.id, days);
  const revenue = useRevenue(days, site.id);
  const observations = connectionObservations(metrics.data, revenue.data, days);
  return (
    <section className="space-y-3" aria-label="Connection diagnostics">
      <h2 className="text-sm font-semibold">
        Connection diagnostics · last {days} days
      </h2>
      <p className="text-xs text-muted-foreground">
        Stored measurements: GA4 sessions, search clicks, AdSense earnings.
        Provider authorization and scheduled job activation are unverified.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {SOURCES.map((source) => (
          <DiagnosticCard
            key={source}
            site={site}
            source={source}
            observation={observations[source]}
            readError={source === "adsense" ? revenue.isError : metrics.isError}
            loading={
              source === "adsense" ? revenue.isLoading : metrics.isLoading
            }
          />
        ))}
      </div>
    </section>
  );
}

function DiagnosticCard({
  site,
  source,
  observation,
  readError,
  loading,
}: {
  site: SiteWithStatuses;
  source: SyncSource;
  observation: Observation;
  readError: boolean;
  loading: boolean;
}) {
  const runs = useSyncRuns({ siteId: site.id, source, limit: 1 });
  const privacy = usePrivacyMode();
  const status = site.statuses.find((s) => s.source === source);
  const latestRun = runs.data?.[0];
  const diagnosis = diagnoseConnection({
    status,
    latestRun,
    observation,
    readError: readError || runs.isError,
    loading: loading || runs.isLoading,
  });
  const params = new URLSearchParams({ siteId: site.id, source });
  if (latestRun) params.set("runId", latestRun.id);
  return (
    <article className="min-w-0 space-y-2 rounded-lg border border-border p-4">
      <h3 className="text-sm font-medium">
        {SOURCE_LABEL[source]} · {diagnosis.title}
      </h3>
      <p className="text-xs text-muted-foreground">
        {privacy.enabled ? "********" : diagnosis.reason}
      </p>
      <p className="text-xs">{diagnosis.action}</p>
      <p className="text-xs text-muted-foreground">
        Last success:{" "}
        {privacy.enabled
          ? "********"
          : relativeTime(status?.last_success_at ?? null)}
      </p>
      <p className="text-xs text-muted-foreground">
        Stored measurement:{" "}
        {privacy.enabled
          ? "********"
          : readError || loading
            ? "unknown"
            : observation}
      </p>
      {latestRun && (
        <p className="break-words text-xs text-muted-foreground">
          {privacy.enabled
            ? "********"
            : `${latestRun.range_start ?? "Unknown start"} → ${latestRun.range_end ?? "Unknown end"} · ${latestRun.error_code ?? "No error code"}`}
        </p>
      )}
      <Link
        className="inline-block text-xs text-primary hover:underline"
        to={`/sync-runs?${params}`}
      >
        Inspect {SOURCE_LABEL[source]} run, period and error
      </Link>
      {runs.isError && (
        <button
          className="ml-3 text-xs text-primary"
          onClick={() => void runs.refetch()}
        >
          Retry history read
        </button>
      )}
    </article>
  );
}
