import type { SiteMetrics } from "./api";
import type { SyncSource } from "@/types/database";
import type { Observation } from "./connection-diagnostics";

export function connectionObservations(
  metrics: SiteMetrics | undefined,
  revenue: { metric_date: string; estimated_earnings: number }[] | undefined,
  days: number,
  now = new Date(),
): Record<SyncSource, Observation> {
  const since = new Date(now.getTime() - days * 86400000)
    .toISOString()
    .slice(0, 10);
  const until = now.toISOString().slice(0, 10);
  const inPeriod = (date: string) => date >= since && date <= until;
  const observe = (values: number[] | undefined): Observation =>
    !values
      ? "unknown"
      : !values.length
        ? "missing"
        : values.every((v) => v === 0)
          ? "zero"
          : "present";
  return {
    ga4: observe(
      metrics?.analytics
        .filter((r) => inPeriod(r.metric_date))
        .map((r) => r.sessions),
    ),
    gsc: observe(
      metrics?.search
        .filter((r) => r.engine === "google" && inPeriod(r.metric_date))
        .map((r) => r.clicks),
    ),
    bing: observe(
      metrics?.search
        .filter((r) => r.engine === "bing" && inPeriod(r.metric_date))
        .map((r) => r.clicks),
    ),
    adsense: observe(
      revenue
        ?.filter((r) => inPeriod(r.metric_date))
        .map((r) => r.estimated_earnings),
    ),
  };
}
