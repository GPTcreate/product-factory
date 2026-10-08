import { useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useRevenue } from "@/features/factory/api";
import { getSyncRuns, type SiteWithStatuses } from "@/lib/api";
import { queryKeys, useSiteMetrics } from "@/lib/hooks";
import { diagnoseConnection } from "@/lib/connection-diagnostics";
import { connectionObservations } from "@/lib/connection-observations";
import { SOURCES, SOURCE_LABEL } from "@/lib/sources";
import { relativeTime } from "@/lib/dates";
import { usePrivacyMode } from "@/lib/privacy";
import { HealthBadge } from "@/components/status/HealthBadge";

export function OperationalIssues({ sites }: { sites: SiteWithStatuses[] }) {
  return (
    <section aria-label="Operational issues" className="space-y-4">
      <h2 className="font-semibold">Operational issues · last 30 days</h2>
      <p className="text-xs text-muted-foreground">
        One issue per product and provider. Stored measurements, configuration
        and execution evidence are separate. Provider access and scheduled jobs
        remain unverified.
      </p>
      {sites.map((site) => (
        <ProductIssues key={site.id} site={site} />
      ))}
    </section>
  );
}

function ProductIssues({ site }: { site: SiteWithStatuses }) {
  const privacy = usePrivacyMode();
  const metrics = useSiteMetrics(site.id, 30);
  const revenue = useRevenue(30, site.id);
  const runs = useQueries({
    queries: SOURCES.map((source) => {
      const filters = { siteId: site.id, source, limit: 1 };
      return {
        queryKey: queryKeys.syncRuns(filters),
        queryFn: () => getSyncRuns(filters),
      };
    }),
  });
  const observations = connectionObservations(metrics.data, revenue.data, 30);
  const diagnoses = SOURCES.map((source, index) => {
    const status = site.statuses.find((s) => s.source === source);
    const run = runs[index].data?.[0];
    const evidence = source === "adsense" ? revenue : metrics;
    return {
      source,
      status,
      run,
      diagnosis: diagnoseConnection({
        status,
        latestRun: run,
        observation: observations[source],
        readError: evidence.isError || runs[index].isError,
        loading: evidence.isLoading || runs[index].isLoading,
      }),
    };
  });
  const healthy = diagnoses.filter((d) => d.diagnosis.state === "healthy");
  const unknown = diagnoses.filter(
    (d) => d.diagnosis.state === "unknown" || d.diagnosis.state === "running",
  );
  const issues = diagnoses.filter(
    (d) => !healthy.includes(d) && !unknown.includes(d),
  );
  const order = {
    critical: 0,
    warning: 1,
    disabled: 2,
    pending: 3,
    healthy: 4,
  };
  return (
    <section
      aria-label={`Issues for ${privacy.maskText(site.name)}`}
      className="space-y-3 rounded-lg border p-4"
    >
      <Link
        to={`/products/${site.id}`}
        className="font-medium text-primary hover:underline"
      >
        {privacy.maskText(site.name)}
      </Link>
      <p className="text-xs">
        {issues.length} issues · {unknown.length} unverified · {healthy.length}{" "}
        normal measurements
      </p>
      {healthy.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Normal measurements:{" "}
          {healthy.map((d) => SOURCE_LABEL[d.source]).join(", ")}. Authorization
          and scheduled jobs remain unverified.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {[...issues, ...unknown]
          .sort(
            (a, b) => order[a.diagnosis.severity] - order[b.diagnosis.severity],
          )
          .map(({ source, status, run, diagnosis }) => {
            const params = new URLSearchParams({ siteId: site.id, source });
            if (run) params.set("runId", run.id);
            const runQuery = runs[SOURCES.indexOf(source)];
            const evidence = source === "adsense" ? revenue : metrics;
            return (
              <article
                key={source}
                aria-label={`${SOURCE_LABEL[source]} issue`}
                className="min-w-0 space-y-2 rounded-lg border p-3"
              >
                <h3 className="text-sm font-medium">{SOURCE_LABEL[source]}</h3>
                <HealthBadge
                  health={{
                    level: diagnosis.severity,
                    title: diagnosis.title,
                    reason: privacy.maskText(diagnosis.reason),
                  }}
                />
                <p className="break-words text-xs">
                  {privacy.maskText(diagnosis.reason)}
                </p>
                <p className="text-xs">{diagnosis.action}</p>
                <p className="text-xs text-muted-foreground">
                  Last success:{" "}
                  {privacy.enabled
                    ? "********"
                    : relativeTime(status?.last_success_at ?? null)}
                </p>
                {run && (
                  <p className="break-words text-xs">
                    {privacy.enabled
                      ? "********"
                      : `${run.range_start ?? "Unknown start"} → ${run.range_end ?? "Unknown end"} · ${run.error_code ?? "No error code"}`}
                  </p>
                )}
                <Link
                  to={`/sync-runs?${params}`}
                  className="block text-xs text-primary hover:underline"
                >
                  Inspect {SOURCE_LABEL[source]} run, period and error
                </Link>
                {(evidence.isError || runQuery.isError) && (
                  <button
                    className="text-xs text-primary"
                    onClick={() => {
                      void evidence.refetch();
                      void runQuery.refetch();
                    }}
                  >
                    Retry evidence read
                  </button>
                )}
              </article>
            );
          })}
      </div>
    </section>
  );
}
