import { useMemo } from "react";
import {
  combineAnalyticsAcrossSites,
  combineSearchAcrossSites,
  computeTrajectories,
} from "@/lib/series";
import { TrajectoryPanel } from "@/components/charts/TrajectoryPanel";
import type { AnalyticsDaily, SearchDaily } from "@/types/database";

const HORIZON_DAYS = 28;

/**
 * Portfolio-wide trajectory: every active site's daily rows summed into one
 * combined series per metric, then forecast the same way as a single site.
 */
export function PortfolioTrajectorySection({
  analytics,
  search,
}: {
  analytics: AnalyticsDaily[];
  search: SearchDaily[];
}) {
  const trajectories = useMemo(() => {
    const combinedAnalytics = combineAnalyticsAcrossSites(analytics);
    const combinedSearch = combineSearchAcrossSites(search);
    return computeTrajectories(combinedAnalytics, combinedSearch, HORIZON_DAYS);
  }, [analytics, search]);

  return (
    <TrajectoryPanel
      title={`전체 제품 예상 추이 · 향후 ${HORIZON_DAYS}일`}
      trajectories={trajectories}
      horizonDays={HORIZON_DAYS}
      maskPrefix="traj:portfolio"
    />
  );
}
