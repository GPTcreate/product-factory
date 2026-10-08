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
      "Unverified",
      readError
        ? "Connection evidence could not be read."
        : loading
          ? "Loading connection evidence."
          : "Integration status is unavailable.",
      "Retry the read; verify provider access and scheduled jobs separately.",
    );
  if (!status.enabled)
    return result(
      "disconnected",
      "disabled",
      "Not configured",
      "This integration is disabled in the Registry.",
      "Review the product's provider identifier and mapping.",
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
      "Running",
      "The latest attempt has not finished; collection is unverified.",
      "Inspect the original run before requesting another sync.",
    );
  if (latest === "failed" || status.consecutive_failures > 0)
    return result(
      "failed",
      health.level === "critical" ? "critical" : "warning",
      "Collection failed",
      latest === "failed" && health.level === "healthy" ? "The latest run failed after the status snapshot." : health.reason,
      "Inspect the original error and verify access or configuration before retrying.",
    );
  if (latest === "partial")
    return result(
      "partial",
      health.level === "critical" ? "critical" : "warning",
      "Partial collection",
      "Only part of the requested report was stored; missing data is not zero.",
      "Inspect the run's requested period, rows and error.",
    );
  if (health.level === "pending" && !currentRun)
    return result(
      "never",
      "pending",
      "Not run yet",
      "Enabled indicates configuration only; no successful collection is verified.",
      "Verify provider access, then arrange the first collection with the operator.",
    );
  if (health.level === "warning" || health.level === "critical")
    return result(
      "stale",
      health.level,
      "Delayed collection",
      health.reason,
      "Compare the last success with the expected schedule; job activation is unverified.",
    );
  if (
    latest === "success" &&
    (currentRun?.rows_written ?? status.last_rows_written) === 0
  )
    return result(
      "empty",
      "warning",
      "Success with 0 rows",
      "The attempt succeeded without storing rows. This does not prove a measured zero.",
      "Inspect the run period and provider mapping; compare stored metric evidence.",
    );
  if (observation === "missing")
    return result(
      "missing",
      "warning",
      "No stored metrics in period",
      "No report rows were found in the selected period; values are uncollected, not zero.",
      "Review the requested dates and mapping in the original run.",
    );
  if (observation === "unknown")
    return result(
      "unknown",
      "pending",
      "Metrics unverified",
      "Stored metric evidence is unavailable; configuration and successful runs alone do not verify values.",
      "Read the period's report rows and verify provider access separately.",
    );
  return result(
    "healthy",
    "healthy",
    observation === "zero"
      ? "Stored zero measurement"
      : "Stored metrics available",
    health.reason,
    "Review the report period; provider access and scheduled jobs remain unverified.",
  );
}
