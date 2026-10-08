import { describe, expect, it } from "vitest";
import { diagnoseConnection } from "./connection-diagnostics";
import type { IntegrationStatus, SyncRun } from "@/types/database";

const now = new Date("2026-10-08T12:00:00Z");
const status: IntegrationStatus = {
  site_id: "fixture",
  source: "ga4",
  enabled: true,
  last_attempt_at: "2026-10-08T10:00:00Z",
  last_success_at: "2026-10-08T10:00:00Z",
  last_status: "success",
  last_duration_ms: 10,
  last_rows_fetched: 1,
  last_rows_written: 1,
  consecutive_failures: 0,
  last_error_code: null,
  last_error_message: null,
  next_run_at: null,
  stale_after_hours: 36,
  updated_at: "2026-10-08T10:00:00Z",
};
const diagnose = (
  patch: Partial<IntegrationStatus> = {},
  extra: Partial<Parameters<typeof diagnoseConnection>[0]> = {},
) =>
  diagnoseConnection({
    status: { ...status, ...patch },
    observation: "present",
    now,
    ...extra,
  });
describe("connection evidence and next action", () => {
  it("distinguishes missing status from a disabled integration", () => {
    expect(diagnose({}, { status: undefined }).state).toBe("unknown");
    expect(diagnose({ enabled: false }).state).toBe("disconnected");
  });
  it("does not treat enabled but never attempted as success", () => {
    expect(
      diagnose({
        last_attempt_at: null,
        last_success_at: null,
        last_status: null,
        last_rows_written: 0,
      }).state,
    ).toBe("never");
  });
  it("keeps success with zero rows distinct from a stored zero", () => {
    expect(
      diagnose({ last_rows_written: 0 }, { observation: "missing" }).state,
    ).toBe("empty");
    expect(diagnose({}, { observation: "zero" }).title).toBe(
      "Stored zero measurement",
    );
    expect(diagnose({}, { observation: "missing" }).state).toBe("missing");
  });
  it.each(["partial", "failed", "running"] as const)(
    "preserves %s despite existing metrics",
    (last_status) => {
      expect(diagnose({ last_status }).state).toBe(last_status);
    },
  );
  it("uses existing health severity for repeated failure and stale collection", () => {
    expect(
      diagnose({ consecutive_failures: 2, last_status: "failed" }).severity,
    ).toBe("critical");
    expect(diagnose({ last_success_at: "2026-10-01T00:00:00Z" }).state).toBe(
      "stale",
    );
  });
  it("never labels read errors or loading as healthy", () => {
    expect(diagnose({}, { readError: true }).state).toBe("unknown");
    expect(diagnose({}, { loading: true }).state).toBe("unknown");
  });
  it("uses newer running evidence but ignores an older failed run", () => {
    const run = {
      started_at: "2026-10-08T11:00:00Z",
      status: "running",
    } as SyncRun;
    expect(diagnose({}, { latestRun: run }).state).toBe("running");
    expect(
      diagnose(
        {},
        {
          latestRun: {
            ...run,
            started_at: "2026-10-01T00:00:00Z",
            status: "failed",
          },
        },
      ).state,
    ).toBe("healthy");
  });
});
