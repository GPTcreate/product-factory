import { useMemo } from "react";
import { computeTrajectories } from "@/lib/series";
import { TrajectoryPanel } from "@/components/charts/TrajectoryPanel";
import type { AnalyticsDaily, SearchDaily } from "@/types/database";

const HORIZON_DAYS = 28;

/**
 * Per-site trajectory: forecasts every volumetric metric (sessions, users,
 * page views, engaged sessions, clicks/impressions per engine) using ALL
 * fetched history (2× the visible window) for a better fit, with a metric
 * switcher so nothing is hidden behind a single "best" pick.
 */
export function TrajectorySection({
  siteId,
  analytics,
  search,
}: {
  siteId: string;
  analytics: AnalyticsDaily[];
  search: SearchDaily[];
}) {
  const trajectories = useMemo(
    () => computeTrajectories(analytics, search, HORIZON_DAYS),
    [analytics, search],
  );

  return (
    <TrajectoryPanel
      title={`향후 추이 예측 · ${HORIZON_DAYS}일`}
      trajectories={trajectories}
      horizonDays={HORIZON_DAYS}
      maskPrefix={`traj:${siteId}`}
    />
  );
}
