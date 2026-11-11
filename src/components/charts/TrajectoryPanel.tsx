import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import {
  trajectoryMetricLabel,
  type TrajectoryMetricResult,
} from "@/lib/series";
import { formatNumber, formatPercentChange } from "@/lib/format";
import { usePrivacyMode } from "@/lib/privacy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  MetricLineChart,
  type ChartRow,
} from "@/components/charts/MetricLineChart";
import { CHART_COLORS } from "@/components/charts/chart-colors";
import { cn } from "@/lib/utils";

/**
 * Metric-switchable forecast panel: a pill per volumetric metric (sessions,
 * users, page views, engaged sessions, clicks/impressions per engine), each
 * showing its own Holt-Winters/linear forecast, confidence band, and trend.
 * Used both per-site and for the portfolio-wide combined trajectory.
 */
export function TrajectoryPanel({
  title,
  trajectories,
  horizonDays,
  maskPrefix,
}: {
  title: string;
  trajectories: TrajectoryMetricResult[];
  horizonDays: number;
  maskPrefix: string;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Only offer metrics with at least some recorded data - hides Bing pills on
  // sites that don't use Bing, for example, instead of an always-empty tab.
  const available = useMemo(
    () => trajectories.filter((t) => t.series.some((p) => p.value > 0)),
    [trajectories],
  );

  const selected =
    available.find((t) => t.key === selectedKey) ??
    available.find((t) => t.forecast != null) ??
    available[0] ??
    null;

  if (!selected) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <EmptyState
          icon={TrendingUp}
          title="아직 자료가 없습니다"
          description="한 가지 이상의 지표에 이력이 쌓이면 예상 추이가 표시됩니다."
        />
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <div className="flex flex-wrap gap-1">
          {available.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setSelectedKey(t.key)}
              aria-pressed={t.key === selected.key}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                t.key === selected.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {trajectoryMetricLabel(t)}
            </button>
          ))}
        </div>
      </div>

      {!selected.forecast ? (
        <EmptyState
          icon={TrendingUp}
          title={`${trajectoryMetricLabel(selected)} 예측을 위한 이력이 부족합니다`}
          description="최소 8일의 자료가 있어야 예측하며, 주간 패턴에는 21일이 필요합니다. 다른 지표를 선택해 보세요."
        />
      ) : (
        <TrajectoryMetricChart
          metric={selected}
          horizonDays={horizonDays}
          maskPrefix={`${maskPrefix}:${selected.key}`}
        />
      )}
    </section>
  );
}

function TrajectoryMetricChart({
  metric,
  horizonDays,
  maskPrefix,
}: {
  metric: TrajectoryMetricResult;
  horizonDays: number;
  maskPrefix: string;
}) {
  const privacy = usePrivacyMode();
  const forecast = metric.forecast!;

  const shown = metric.series.slice(-60);
  const rows: ChartRow[] = shown.map((p) => ({
    date: p.date,
    [metric.label]: privacy.maskNumber(p.value, `${maskPrefix}:${p.date}:obs`),
  }));
  const last = shown[shown.length - 1];
  if (last) {
    rows[rows.length - 1].Forecast = privacy.maskNumber(
      last.value,
      `${maskPrefix}:${last.date}:obs`,
    );
  }
  for (const p of forecast.points) {
    const value =
      privacy.maskNumber(p.value, `${maskPrefix}:${p.date}:fc`) ?? 0;
    const lower =
      privacy.maskNumber(p.lower, `${maskPrefix}:${p.date}:lo`) ?? 0;
    const upper =
      privacy.maskNumber(p.upper, `${maskPrefix}:${p.date}:hi`) ?? 0;
    rows.push({
      date: p.date,
      Forecast: value,
      band: [Math.min(lower, upper), Math.max(lower, upper)] as [
        number,
        number,
      ],
    });
  }

  const trendPerWeek = forecast.trendPerDay * 7;
  const lastValue = last?.value ?? 0;
  const trendPct = lastValue > 0 ? (trendPerWeek / lastValue) * 100 : null;
  const horizonTotal =
    privacy.maskNumber(
      Math.round(forecast.horizonTotal),
      `${maskPrefix}:horizon-total`,
    ) ?? 0;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label={`예상 ${trajectoryMetricLabel(metric)} (${horizonDays}일)`}
          value={formatNumber(Math.round(horizonTotal))}
          hint={
            <span className="text-muted-foreground">
              {forecast.method === "holt-winters"
                ? "주간 계절성 모형"
                : "선형 추세 (짧은 관측 기간)"}
            </span>
          }
        />
        <StatCard
          label="주당 추세 변화"
          value={
            <span
              className={trendPerWeek >= 0 ? "text-success" : "text-critical"}
            >
              {trendPerWeek >= 0 ? "+" : ""}
              {formatNumber(
                Math.round(
                  privacy.maskNumber(
                    trendPerWeek,
                    `${maskPrefix}:trend-week`,
                  ) ?? 0,
                ),
              )}
            </span>
          }
          hint={
            trendPct != null ? (
              <span className="text-muted-foreground">
                현재 일별 수준 대비{" "}
                {formatPercentChange(privacy.enabled ? null : trendPct)}
              </span>
            ) : undefined
          }
        />
        <StatCard
          label="예측 불확실성"
          value={`±${formatNumber(
            Math.round(
              privacy.maskNumber(
                1.28 * forecast.residualStd,
                `${maskPrefix}:uncertainty`,
              ) ?? 0,
            ),
          )}`}
          hint={
            <span className="text-muted-foreground">일별 80% 예측 범위</span>
          }
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{trajectoryMetricLabel(metric)}: 관측·예측</CardTitle>
        </CardHeader>
        <CardContent>
          <MetricLineChart
            data={rows}
            bandKey="band"
            series={[
              {
                key: metric.label,
                name: trajectoryMetricLabel(metric),
                color: CHART_COLORS.primary,
              },
              {
                key: "Forecast",
                name: "예측",
                color: CHART_COLORS.violet,
                dashed: true,
              },
            ]}
          />
        </CardContent>
      </Card>
    </>
  );
}
