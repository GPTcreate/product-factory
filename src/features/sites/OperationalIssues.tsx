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
    <section aria-label="운영 점검 사항" className="space-y-4">
      <h2 className="font-semibold">운영 점검 사항 · 최근 30일</h2>
      <p className="text-xs text-muted-foreground">
        제품과 서비스별 점검 사항입니다. 저장된 측정 자료와 설정, 실행 근거는
        각각 확인합니다. 서비스 접근 권한과 예약 작업 실행 여부는 확인되지
        않았습니다.
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
      aria-label={`${privacy.maskText(site.name)} 운영 점검 사항`}
      className="space-y-3 rounded-lg border p-4"
    >
      <Link
        to={`/products/${site.id}`}
        className="font-medium text-primary hover:underline"
      >
        {privacy.maskText(site.name)}
      </Link>
      <p className="text-xs">
        점검 필요 {issues.length}개 · 미확인 {unknown.length}개 · 정상 측정{" "}
        {healthy.length}개
      </p>
      {healthy.length > 0 && (
        <p className="text-xs text-muted-foreground">
          정상 측정: {healthy.map((d) => SOURCE_LABEL[d.source]).join(", ")}.
          접근 권한과 예약 작업은 확인되지 않았습니다.
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
                aria-label={`${SOURCE_LABEL[source]} 점검 사항`}
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
                  최근 성공:{" "}
                  {privacy.enabled
                    ? "********"
                    : relativeTime(status?.last_success_at ?? null)}
                </p>
                {run && (
                  <p className="break-words text-xs">
                    {privacy.enabled
                      ? "********"
                      : `${run.range_start ?? "시작일 미상"} → ${run.range_end ?? "종료일 미상"} · ${run.error_code ?? "오류 코드 없음"}`}
                  </p>
                )}
                <Link
                  to={`/sync-runs?${params}`}
                  className="block text-xs text-primary hover:underline"
                >
                  {SOURCE_LABEL[source]} 실행·기간·오류 확인
                </Link>
                {(evidence.isError || runQuery.isError) && (
                  <button
                    className="text-xs text-primary"
                    onClick={() => {
                      void evidence.refetch();
                      void runQuery.refetch();
                    }}
                  >
                    근거 자료 다시 읽기
                  </button>
                )}
              </article>
            );
          })}
      </div>
    </section>
  );
}
