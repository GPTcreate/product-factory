import { formatDistanceStrict } from "date-fns";
import { ko } from "date-fns/locale";
import type { IntegrationStatus } from "@/types/database";

export type HealthLevel =
  | "healthy"
  | "warning"
  | "critical"
  | "pending"
  | "disabled";

export interface IntegrationHealth {
  level: HealthLevel;
  title: string;
  reason: string;
}

/**
 * Normalized error codes that always indicate a critical, human-actionable
 * problem (revoked/invalid credentials, permission denied, missing config).
 * The sync framework (Phase 5+) emits these; kept here so health logic is the
 * single source of truth.
 */
const CRITICAL_ERROR_CODES = new Set([
  "auth_error",
  "invalid_credentials",
  "invalid_grant",
  "unauthorized",
  "permission_denied",
  "config_missing",
]);

const HEALTHY: Pick<IntegrationHealth, "level" | "title"> = {
  level: "healthy",
  title: "정상",
};

function ago(date: Date, now: Date): string {
  return formatDistanceStrict(date, now, { addSuffix: true, locale: ko });
}

/**
 * Shared integration health calculation (brief §12). Used everywhere in the UI
 * so the badge on the overview matches the card on the site detail page.
 */
export function computeHealth(
  status: Pick<
    IntegrationStatus,
    | "enabled"
    | "last_status"
    | "last_attempt_at"
    | "last_success_at"
    | "consecutive_failures"
    | "stale_after_hours"
    | "last_error_code"
  >,
  now: Date = new Date(),
): IntegrationHealth {
  if (!status.enabled) {
    return {
      level: "disabled",
      title: "비활성",
      reason: "이 연동은 비활성화되어 있습니다.",
    };
  }

  // A freshly-added integration that has never even been attempted isn't
  // failing - it just needs its first sync. Show a neutral "pending" state
  // (not amber warning, and not counted as needing attention).
  if (
    !status.last_attempt_at &&
    !status.last_success_at &&
    status.consecutive_failures === 0
  ) {
    return {
      level: "pending",
      title: "첫 수집 대기",
      reason: "아직 수집한 이력이 없습니다. 첫 수집 결과를 확인하세요.",
    };
  }

  const lastSuccess = status.last_success_at
    ? new Date(status.last_success_at)
    : null;
  const ageHours = lastSuccess
    ? (now.getTime() - lastSuccess.getTime()) / 3_600_000
    : Infinity;
  const stale = status.stale_after_hours;
  const fails = status.consecutive_failures;

  // ---- Critical -----------------------------------------------------------
  if (
    status.last_error_code &&
    CRITICAL_ERROR_CODES.has(status.last_error_code)
  ) {
    return {
      level: "critical",
      title: "확인 필요",
      reason: "인증 또는 접근 권한을 확인해 주세요.",
    };
  }
  if (fails >= 2) {
    return {
      level: "critical",
      title: "확인 필요",
      reason: `${fails}회 연속 수집에 실패했습니다.`,
    };
  }
  if (!lastSuccess) {
    return {
      level: "critical",
      title: "확인 필요",
      reason: "아직 정상 수집에 성공한 이력이 없습니다.",
    };
  }
  if (ageHours > stale * 2) {
    return {
      level: "critical",
      title: "확인 필요",
      reason: `마지막 정상 수집은 ${ago(lastSuccess, now)}이며, 최신성 기준 ${stale}시간을 크게 넘겼습니다.`,
    };
  }

  // ---- Warning ------------------------------------------------------------
  if (fails === 1) {
    return {
      level: "warning",
      title: "주의",
      reason: `최근 수집이 한 번 실패했습니다. 마지막 정상 수집은 ${ago(lastSuccess, now)}입니다.`,
    };
  }
  if (status.last_status === "partial") {
    return {
      level: "warning",
      title: "주의",
      reason: "최근 수집이 일부만 완료되었습니다.",
    };
  }
  if (ageHours > stale) {
    return {
      level: "warning",
      title: "주의",
      reason: `마지막 정상 수집이 최신성 기준 ${stale}시간을 넘겼습니다.`,
    };
  }
  if (status.last_status === "failed") {
    return {
      level: "warning",
      title: "주의",
      reason: `최근 수집에 실패했습니다. 마지막 정상 수집은 ${ago(lastSuccess, now)}입니다.`,
    };
  }

  // ---- Healthy ------------------------------------------------------------
  return {
    ...HEALTHY,
    reason: `마지막 정상 수집 ${ago(lastSuccess, now)}.`,
  };
}
