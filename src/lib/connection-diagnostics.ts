import { computeHealth, type HealthLevel } from "./health";
import type { IntegrationStatus, SyncRun } from "@/types/database";

export type Observation = "unknown" | "missing" | "zero" | "present";
export interface Diagnosis {
  state:
    | "unknown"
    | "disconnected"
    | "never"
    | "running"
    | "failed"
    | "partial"
    | "stale"
    | "empty"
    | "missing"
    | "healthy";
  severity: HealthLevel;
  title: string;
  reason: string;
  action: string;
  observation: Observation;
}

/** Read-only model shared by product diagnostics and the portfolio issue list.
 * A successful run and a stored zero metric are independent observations. */
export function diagnoseConnection({
  status,
  latestRun,
  observation = "unknown",
  readError = false,
  loading = false,
  now = new Date(),
}: {
  status?: IntegrationStatus;
  latestRun?: SyncRun;
  observation?: Observation;
  readError?: boolean;
  loading?: boolean;
  now?: Date;
}): Diagnosis {
  const result = (
    state: Diagnosis["state"],
    severity: HealthLevel,
    title: string,
    reason: string,
    action: string,
  ): Diagnosis => ({ state, severity, title, reason, action, observation });
  if (readError || loading || !status)
    return result(
      "unknown",
      "pending",
      "확인 전",
      readError
        ? "연결 상태의 근거 자료를 불러오지 못했습니다."
        : loading
          ? "연결 근거 자료를 불러오는 중입니다."
          : "연동 상태를 확인할 수 없습니다.",
      "자료를 다시 불러오고, 공급자 접근 권한과 예약 실행 여부는 각각 확인하세요.",
    );
  if (!status.enabled)
    return result(
      "disconnected",
      "disabled",
      "비활성",
      "이 연동은 제품 설정에서 비활성화되어 있습니다.",
      "사용할 연동인 경우 제품의 공급자 식별자와 연결 설정을 확인하세요.",
    );
  const health = computeHealth(status, now);
  // Prefer a run only when it is at least as recent as the status snapshot.
  const currentRun =
    latestRun &&
    (!status.last_attempt_at || latestRun.started_at >= status.last_attempt_at)
      ? latestRun
      : undefined;
  const latest = currentRun?.status ?? status.last_status;
  if (latest === "running")
    return result(
      "running",
      "pending",
      "수집 중",
      "최근 실행이 아직 끝나지 않아 수집 결과를 확인할 수 없습니다.",
      "다시 수집하기 전에 현재 실행 내역을 확인하세요.",
    );
  if (latest === "failed" || status.consecutive_failures > 0)
    return result(
      "failed",
      health.level === "critical" ? "critical" : "warning",
      "수집 실패",
      latest === "failed" && health.level === "healthy"
        ? "상태가 기록된 이후의 최근 수집이 실패했습니다."
        : health.reason,
      "다시 시도하기 전에 원본 오류와 접근 권한·설정을 확인하세요.",
    );
  if (latest === "partial")
    return result(
      "partial",
      health.level === "critical" ? "critical" : "warning",
      "일부 수집",
      "요청한 보고서가 일부만 저장되었습니다. 누락된 값을 0으로 간주하지 않습니다.",
      "실행 내역의 요청 기간·수집 건수·오류를 확인하세요.",
    );
  if (health.level === "pending" && !currentRun)
    return result(
      "never",
      "pending",
      "첫 수집 대기",
      "연동이 켜져 있지만 정상 수집 여부는 아직 확인되지 않았습니다.",
      "공급자 접근 권한을 확인한 뒤 첫 수집을 진행하세요.",
    );
  if (health.level === "warning" || health.level === "critical")
    return result(
      "stale",
      health.level,
      "수집 지연",
      health.reason,
      "마지막 정상 수집 시각과 예정 일정을 비교하세요. 예약 활성 여부는 별도 확인이 필요합니다.",
    );
  if (
    latest === "success" &&
    (currentRun?.rows_written ?? status.last_rows_written) === 0
  )
    return result(
      "empty",
      "warning",
      "정상 응답 · 저장 0건",
      "실행은 성공했지만 저장된 행이 없습니다. 실제 측정값이 0이라는 뜻은 아닙니다.",
      "실행 기간과 공급자 연결 설정을 확인하고 저장된 지표와 대조하세요.",
    );
  if (observation === "missing")
    return result(
      "missing",
      "warning",
      "기간 내 저장 지표 없음",
      "선택한 기간에 보고서 행이 없습니다. 미수집 상태이며 0을 뜻하지 않습니다.",
      "원본 실행 내역의 요청 기간과 연결 설정을 확인하세요.",
    );
  if (observation === "unknown")
    return result(
      "unknown",
      "pending",
      "지표 확인 전",
      "저장 지표의 근거를 확인할 수 없습니다. 연결 설정과 실행 성공만으로 측정값을 확정하지 않습니다.",
      "해당 기간의 보고서 행을 확인하고 공급자 접근 권한도 별도로 점검하세요.",
    );
  return result(
    "healthy",
    "healthy",
    observation === "zero" ? "저장된 측정값 0" : "저장 지표 확인",
    health.reason,
    "보고서 기간을 확인하세요. 공급자 접근 권한과 예약 실행 여부는 별도로 확인해야 합니다.",
  );
}
