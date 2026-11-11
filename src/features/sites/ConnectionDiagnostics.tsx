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

const OBSERVATION_LABELS: Record<Observation, string> = {
  unknown: "확인되지 않음",
  missing: "자료 없음",
  zero: "측정값 0",
  present: "자료 있음",
};

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
    <section className="space-y-3" aria-label="서비스 연결 진단">
      <h2 className="text-sm font-semibold">
        서비스 연결 진단 · 최근 {days}일
      </h2>
      <p className="text-xs text-muted-foreground">
        저장된 측정 자료: GA4 세션, 검색 클릭, AdSense 수익. 서비스 접근 권한과
        예약 작업 활성화 여부는 확인되지 않았습니다.
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
        최근 성공:{" "}
        {privacy.enabled
          ? "********"
          : relativeTime(status?.last_success_at ?? null)}
      </p>
      <p className="text-xs text-muted-foreground">
        저장된 측정 자료:{" "}
        {privacy.enabled
          ? "********"
          : readError || loading
            ? "확인되지 않음"
            : OBSERVATION_LABELS[observation]}
      </p>
      {latestRun && (
        <p className="break-words text-xs text-muted-foreground">
          {privacy.enabled
            ? "********"
            : `${latestRun.range_start ?? "시작일 미상"} → ${latestRun.range_end ?? "종료일 미상"} · ${latestRun.error_code ?? "오류 코드 없음"}`}
        </p>
      )}
      <Link
        className="inline-block text-xs text-primary hover:underline"
        to={`/sync-runs?${params}`}
      >
        {SOURCE_LABEL[source]} 실행·기간·오류 확인
      </Link>
      {runs.isError && (
        <button
          className="ml-3 text-xs text-primary"
          onClick={() => void runs.refetch()}
        >
          이력 다시 읽기
        </button>
      )}
    </article>
  );
}
