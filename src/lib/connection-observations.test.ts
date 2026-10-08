import { describe, it, expect } from "vitest";
import { connectionObservations } from "./connection-observations";
import type { SiteMetrics } from "./api";

describe("shared connection observations", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  it("keeps unavailable evidence distinct from an empty period", () => {
    expect(connectionObservations(undefined, undefined, 30, now).ga4).toBe(
      "unknown",
    );
    expect(
      connectionObservations({ analytics: [], search: [] }, [], 30, now),
    ).toEqual({
      ga4: "missing",
      gsc: "missing",
      bing: "missing",
      adsense: "missing",
    });
  });
  it("separates stored zero and measured activity by provider within the period", () => {
    const metrics = {
      analytics: [
        { metric_date: "2026-10-08", sessions: 0 },
        { metric_date: "2026-01-01", sessions: 99 },
      ],
      search: [
        { metric_date: "2026-10-08", engine: "google", clicks: 1 },
        { metric_date: "2026-10-09", engine: "bing", clicks: 3 },
      ],
    } as SiteMetrics;
    expect(
      connectionObservations(
        metrics,
        [{ metric_date: "2026-10-08", estimated_earnings: 0 }],
        30,
        now,
      ),
    ).toEqual({
      ga4: "zero",
      gsc: "present",
      bing: "missing",
      adsense: "zero",
    });
  });
});
