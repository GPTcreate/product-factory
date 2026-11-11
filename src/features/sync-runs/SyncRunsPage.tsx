import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import { useSites, useSyncRuns } from "@/lib/hooks";
import type { SyncRunRow, SyncRunFilters } from "@/lib/api";
import { SOURCES, SOURCE_LABEL } from "@/lib/sources";
import { absoluteTime } from "@/lib/dates";
import { formatDuration, formatNumber } from "@/lib/format";
import type { SyncSource, SyncStatus, TriggerType } from "@/types/database";
import { SyncRunsTable } from "@/features/sync-runs/SyncRunsTable";
import {
  SYNC_STATUS_LABELS,
  SYNC_TRIGGER_LABELS,
} from "@/components/status/sync-labels";
import { SyncStatusPill } from "@/components/status/SyncStatusPill";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { usePrivacyMode } from "@/lib/privacy";
import { readableError } from "@/lib/ui-errors";

const STATUSES: SyncStatus[] = ["success", "partial", "failed", "running"];
const TRIGGERS: TriggerType[] = ["scheduled", "manual", "backfill"];

export function SyncRunsPage() {
  const [params, setParams] = useSearchParams();
  const privacy = usePrivacyMode();
  const { data: sites } = useSites();
  const [filters, setFilters] = useState<SyncRunFilters>({
    limit: 200,
    siteId: params.get("siteId") ?? undefined,
    source: SOURCES.find((s) => s === params.get("source")),
    runId: params.get("runId") ?? undefined,
  });
  const [selected, setSelected] = useState<SyncRunRow | null>(null);

  const { data: runs, isLoading, isError, refetch } = useSyncRuns(filters);
  const focusedRun =
    selected ??
    (params.get("runId")
      ? runs?.find((r) => r.id === params.get("runId"))
      : null);

  const update = (patch: Partial<SyncRunFilters>) =>
    setFilters((f) => ({ ...f, runId: undefined, ...patch }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">수집 이력</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          포트폴리오 전체의 수집 실행 내역을 확인합니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select
          label="제품"
          value={filters.siteId ?? ""}
          onChange={(v) => update({ siteId: v || undefined })}
          options={[
            { value: "", label: "전체 제품" },
            ...(sites ?? []).map((s) => ({
              value: s.id,
              label: privacy.maskText(s.name, `sync-filter:${s.id}:name`),
            })),
          ]}
        />
        <Select
          label="수집 소스"
          value={filters.source ?? ""}
          onChange={(v) => update({ source: (v || undefined) as SyncSource })}
          options={[
            { value: "", label: "전체 소스" },
            ...SOURCES.map((s) => ({ value: s, label: SOURCE_LABEL[s] })),
          ]}
        />
        <Select
          label="상태"
          value={filters.status ?? ""}
          onChange={(v) => update({ status: (v || undefined) as SyncStatus })}
          options={[
            { value: "", label: "전체 상태" },
            ...STATUSES.map((s) => ({
              value: s,
              label: SYNC_STATUS_LABELS[s],
            })),
          ]}
        />
        <Select
          label="실행 방식"
          value={filters.triggerType ?? ""}
          onChange={(v) =>
            update({ triggerType: (v || undefined) as TriggerType })
          }
          options={[
            { value: "", label: "전체 실행 방식" },
            ...TRIGGERS.map((t) => ({
              value: t,
              label: SYNC_TRIGGER_LABELS[t],
            })),
          ]}
        />
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          시작일
          <input
            type="date"
            value={filters.since ?? ""}
            onChange={(e) => update({ since: e.target.value || undefined })}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
          />
        </label>
      </div>

      {isLoading && <Skeleton className="h-64" />}
      {isError && <ErrorState onRetry={() => void refetch()} />}
      {runs && runs.length === 0 && (
        <EmptyState
          title="조건에 맞는 수집 이력이 없습니다"
          description="조회 조건을 변경하거나 수집 실행 후 이력을 확인하세요."
        />
      )}
      {runs && runs.length > 0 && (
        <SyncRunsTable runs={runs} onSelect={setSelected} />
      )}

      {focusedRun && (
        <RunDetailPanel
          run={focusedRun}
          onClose={() => {
            setSelected(null);
            setParams((p) => {
              p.delete("runId");
              return p;
            });
            setFilters((f) => ({ ...f, runId: undefined }));
          }}
        />
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-border bg-background px-2 text-sm capitalize text-foreground"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function RunDetailPanel({
  run,
  onClose,
}: {
  run: SyncRunRow;
  onClose: () => void;
}) {
  const privacy = usePrivacyMode();
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="수집 실행 상세"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold">
              {privacy.maskText(
                run.site_name,
                `run-detail:${run.site_id}:name`,
              )}
            </h2>
            <p className="text-xs text-muted-foreground">
              {SOURCE_LABEL[run.source]} ·{" "}
              {SYNC_TRIGGER_LABELS[run.trigger_type]}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <Detail label="상태" value={<SyncStatusPill status={run.status} />} />
          <Detail
            label="시작 시각"
            value={privacy.enabled ? "********" : absoluteTime(run.started_at)}
          />
          <Detail
            label="종료 시각"
            value={privacy.enabled ? "********" : absoluteTime(run.finished_at)}
          />
          <Detail
            label="요청 기간"
            value={
              privacy.enabled
                ? "********"
                : run.range_start && run.range_end
                  ? `${run.range_start} → ${run.range_end}`
                  : "-"
            }
          />
          <Detail
            label="소요 시간"
            value={
              privacy.enabled
                ? `${formatNumber(
                    privacy.maskNumber(
                      run.duration_ms ?? 0,
                      `run-detail:${run.id}:duration`,
                    ),
                  )}ms`
                : formatDuration(run.duration_ms)
            }
          />
          <Detail
            label="가져온 행 수"
            value={formatNumber(
              privacy.maskNumber(
                run.rows_fetched,
                `run-detail:${run.id}:rows-fetched`,
              ),
            )}
          />
          <Detail
            label="저장한 행 수"
            value={formatNumber(
              privacy.maskNumber(
                run.rows_written,
                `run-detail:${run.id}:rows-written`,
              ),
            )}
          />
          <Detail label="오류 코드" value={run.error_code ?? "-"} />
        </div>

        {run.error_message && (
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground">
              오류 내용
            </p>
            <p className="mt-1 rounded-md border border-critical/30 bg-critical/5 p-2 text-xs text-foreground">
              {privacy.maskText(
                readableError(
                  { message: run.error_message, code: run.error_code },
                  "수집에 실패했습니다. 오류 코드를 확인하세요.",
                ),
                `run-detail:${run.id}:error`,
              )}
            </p>
          </div>
        )}

        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">
            실행 메타데이터
          </p>
          <pre className="mt-1 overflow-x-auto rounded-md border border-border bg-muted/40 p-2 text-xs">
            {privacy.enabled
              ? "********"
              : JSON.stringify(run.metadata, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
