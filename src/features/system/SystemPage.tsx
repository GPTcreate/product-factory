import { useState } from "react";
import { Database, Trash2 } from "lucide-react";
import { env } from "@/lib/env";
import { useDbUsage, useRunCleanup } from "@/lib/hooks";
import type { DbUsage } from "@/lib/api";
import { formatBytes, formatNumber } from "@/lib/format";
import { relativeTime, absoluteTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { usePrivacyMode } from "@/lib/privacy";
import { RuntimeConfiguration } from "./RuntimeConfiguration";
import { OperationalAlerts } from "./OperationalAlerts";

const LIMIT_BYTES = env.VITE_DB_SIZE_LIMIT_MB * 1024 * 1024;

// Tables the cleanup job prunes - labelled with their retention window so the
// page documents the policy that 0008_data_retention.sql enforces.
const RETENTION = [
  { table: "analytics_daily", window: "540일" },
  { table: "search_daily", window: "540일" },
  { table: "search_query_daily", window: "210일" },
  { table: "search_page_daily", window: "210일" },
  { table: "sync_runs", window: "120일" },
];

export function SystemPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">시스템</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          데이터베이스 사용량과 보관 기간을 관리합니다.
        </p>
      </div>
      <DatabaseUsageCard />
      <RuntimeConfiguration />
      <OperationalAlerts />
      <RetentionCard />
    </div>
  );
}

function DatabaseUsageCard() {
  const usage = useDbUsage();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <Database className="h-4 w-4 text-muted-foreground" aria-hidden />
        <CardTitle>데이터베이스 사용량</CardTitle>
      </CardHeader>
      <CardContent>
        {usage.isLoading ? (
          <Skeleton className="h-40" />
        ) : usage.isError || !usage.data ? (
          <ErrorState
            title="데이터베이스 사용량을 읽지 못했습니다"
            description="사용량 현황을 불러오지 못했습니다."
            onRetry={() => void usage.refetch()}
          />
        ) : (
          <UsageBody usage={usage.data} />
        )}
      </CardContent>
    </Card>
  );
}

function UsageBody({ usage }: { usage: DbUsage }) {
  const privacy = usePrivacyMode();
  const used = usage.database_bytes;
  const displayUsed = privacy.maskNumber(used, "system:db-used") ?? used;
  const displayLimit =
    privacy.maskNumber(LIMIT_BYTES, "system:db-limit") ?? LIMIT_BYTES;
  const ratio = LIMIT_BYTES > 0 ? used / LIMIT_BYTES : 0;
  const pct = Math.min(100, Math.round(ratio * 100));
  const level =
    ratio >= 0.9 ? "critical" : ratio >= 0.7 ? "warning" : "success";
  const barColor =
    level === "critical"
      ? "bg-critical"
      : level === "warning"
        ? "bg-warning"
        : "bg-success";

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">
            {formatBytes(displayUsed)}{" "}
            <span className="text-muted-foreground">
              / {formatBytes(displayLimit)}
            </span>
          </span>
          <span
            className={cn(
              "font-semibold",
              level === "critical"
                ? "text-critical"
                : level === "warning"
                  ? "text-warning"
                  : "text-muted-foreground",
            )}
          >
            {pct}%
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", barColor)}
            style={{ width: `${Math.max(2, pct)}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        {level !== "success" && (
          <p className="mt-2 text-xs text-muted-foreground">
            {level === "critical"
              ? "요금제 용량 한도에 가까워지고 있습니다. 오래된 데이터를 정리하거나 요금제를 변경하세요."
              : "사용량이 증가하고 있습니다. 정리는 매주 실행되므로 사용량을 확인하세요."}
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-2 pr-4 font-medium">데이터 표</th>
              <th className="py-2 pr-4 text-right font-medium">용량</th>
              <th className="py-2 text-right font-medium">행 수(추정)</th>
            </tr>
          </thead>
          <tbody>
            {usage.tables.map((t) => (
              <tr key={t.name} className="border-b border-border last:border-0">
                <td className="py-2 pr-4 font-mono text-xs">{t.name}</td>
                <td className="py-2 pr-4 text-right">
                  {formatBytes(
                    privacy.maskNumber(t.total_bytes, `system:${t.name}:bytes`),
                  )}
                </td>
                <td className="py-2 text-right text-muted-foreground">
                  {formatNumber(
                    privacy.maskNumber(t.row_estimate, `system:${t.name}:rows`),
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p
        className="text-xs text-muted-foreground"
        title={privacy.enabled ? "********" : absoluteTime(usage.captured_at)}
      >
        사용량 확인 시각{" "}
        {privacy.enabled ? "********" : relativeTime(usage.captured_at)}.
      </p>
    </div>
  );
}

function RetentionCard() {
  const privacy = usePrivacyMode();
  const cleanup = useRunCleanup();
  const [confirming, setConfirming] = useState(false);
  const result = cleanup.data;

  const preview = () => {
    setConfirming(false);
    cleanup.mutate(true);
  };
  const runNow = () => {
    setConfirming(false);
    cleanup.mutate(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <Trash2 className="h-4 w-4 text-muted-foreground" aria-hidden />
        <CardTitle>데이터 보관</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          오래된 데이터는 매주 일요일 자동으로 정리됩니다. 삭제할 내용을 미리
          확인하거나 지금 정리할 수 있습니다. 오래된 지표를 삭제해도 전체 현황의
          7·30·90일 조회에는 영향을 주지 않습니다.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-4 font-medium">데이터 표</th>
                <th className="py-2 pr-4 font-medium">보관 기간</th>
                <th className="py-2 text-right font-medium">
                  {result ? (result.dry_run ? "삭제 예정" : "삭제됨") : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {RETENTION.map((r) => (
                <tr
                  key={r.table}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-2 pr-4 font-mono text-xs">{r.table}</td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {r.window}
                  </td>
                  <td className="py-2 text-right">
                    {result
                      ? formatNumber(
                          privacy.maskNumber(
                            result.deleted[
                              r.table as keyof typeof result.deleted
                            ],
                            `retention:${r.table}:deleted`,
                          ),
                        )
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {cleanup.isError && (
          <Alert tone="error">
            데이터 정리에 실패했습니다. 다시 시도하세요.
          </Alert>
        )}
        {result && !cleanup.isError && (
          <Alert tone={result.dry_run ? "info" : "success"}>
            {result.dry_run
              ? "미리보기 결과입니다. 데이터를 삭제하지 않았습니다."
              : "데이터 정리를 완료했습니다. 오래된 행을 삭제했습니다."}
          </Alert>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={cleanup.isPending && cleanup.variables === true}
            onClick={preview}
          >
            미리보기
          </Button>
          {confirming ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                오래된 데이터를 영구 삭제할까요?
              </span>
              <Button
                variant="danger"
                size="sm"
                loading={cleanup.isPending && cleanup.variables === false}
                onClick={runNow}
              >
                확인
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(false)}
              >
                취소
              </Button>
            </div>
          ) : (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirming(true)}
            >
              지금 데이터 정리
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
