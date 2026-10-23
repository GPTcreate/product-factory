import { useState } from "react";
import { Link } from "react-router-dom";
import {
  periodValue,
  weeklyRange,
} from "../../../supabase/functions/_shared/operations";
import { useOperationsMetrics, useProductOperations } from "./operations-api";
import type { SiteWithStatuses } from "@/lib/api";
import { computeHealth } from "@/lib/health";
import { usePrivacyMode } from "@/lib/privacy";
import { Button } from "@/components/ui/button";

export function WeeklyOperationsReport({
  sites,
  week,
}: {
  sites: SiteWithStatuses[];
  week: string;
}) {
  const [view, setView] = useState(false);
  return (
    <section className="factory-panel space-y-3">
      <h2 className="font-semibold">주간 운영 리포트와 연결 작업</h2>
      <p className="text-sm text-muted-foreground">
        선택한 주의 완료된 날짜를 직전 주의 같은 길이 구간과 비교합니다.
        공급자별 보고 시간대 차이는 유지하며, 누락은 0으로 채우지 않습니다.
      </p>
      <Button variant="secondary" onClick={() => setView(!view)}>
        {view ? "Close weekly report" : "Open weekly report"}
      </Button>
      {view &&
        sites.map((site) => (
          <ProductWeek key={`${site.id}:${week}`} site={site} week={week} />
        ))}
    </section>
  );
}
function ProductWeek({ site, week }: { site: SiteWithStatuses; week: string }) {
  const privacy = usePrivacyMode();
  const range = weeklyRange(week);
  const metrics = useOperationsMetrics(site.id, range.previousStart, range.end);
  const operations = useProductOperations(site.id);
  if (privacy.enabled) return <p>Hide all data is enabled.</p>;
  if (range.days === 0) return <p>이 주에는 아직 완료된 날짜가 없습니다.</p>;
  if (metrics.isLoading || operations.isLoading)
    return <p role="status">Loading weekly report…</p>;
  if (
    metrics.isError ||
    operations.isError ||
    !metrics.data ||
    !operations.data
  )
    return (
      <div role="alert">
        리포트 데이터 읽기 실패.{" "}
        <Button
          onClick={() => {
            void metrics.refetch();
            void operations.refetch();
          }}
        >
          Retry weekly report
        </Button>
      </div>
    );
  const m = metrics.data;
  const series = [
    {
      name: "Sessions",
      rows: m.analytics.map((r) => ({
        metric_date: r.metric_date,
        value: r.sessions,
      })),
    },
    {
      name: "Core action",
      rows: m.events.map((r) => ({
        metric_date: r.metric_date,
        value: r.event_count,
      })),
    },
    {
      name: "Google clicks",
      rows: m.search
        .filter((r) => r.engine === "google")
        .map((r) => ({ metric_date: r.metric_date, value: r.clicks })),
    },
    {
      name: "Bing clicks",
      rows: m.search
        .filter((r) => r.engine === "bing")
        .map((r) => ({ metric_date: r.metric_date, value: r.clicks })),
    },
    {
      name: "AdSense",
      rows: m.revenue.map((r) => ({
        metric_date: r.metric_date,
        value: Number(r.estimated_earnings),
        currency: r.currency_code,
      })),
    },
  ];
  const summary = series.map((s) => {
    const current = periodValue(s.rows, range.start, range.end),
      previous = periodValue(s.rows, range.previousStart, range.previousEnd);
    const currencies = new Set(
      s.rows
        .filter(
          (r) =>
            r.metric_date >= range.previousStart && r.metric_date <= range.end,
        )
        .flatMap((r) => ("currency" in r && r.currency ? [r.currency] : [])),
    );
    const comparable =
      current.days === range.days &&
      previous.days === range.days &&
      current.value !== null &&
      previous.value !== null &&
      previous.value > 0 &&
      currencies.size <= 1;
    return {
      name: s.name,
      current,
      previous,
      change: comparable
        ? (
            ((current.value! - previous.value!) / previous.value!) *
            100
          ).toFixed(1) + "%"
        : "비교 불가",
    };
  });
  const tasks = operations.data.tasks.filter((t) => t.week_start === week);
  const issues = site.statuses
    .map((s) => ({ source: s.source, health: computeHealth(s) }))
    .filter((s) => s.health.level !== "healthy");
  const reportText = [
    `${site.product_code ?? ""} ${site.name}`,
    `${range.start} → ${range.end} · ${range.days} completed days`,
    ...summary.map(
      (s) =>
        `${s.name}: ${s.current.value ?? "No Data"} ${s.current.currency ?? ""}; observed ${s.current.days}/${range.days} days; change ${s.change}`,
    ),
    ...issues.map((i) => `${i.source}: ${i.health.reason}`),
    ...tasks.map(
      (t) =>
        `[${t.status}] ${t.title} / ${t.owner || "unassigned"} / ${t.due_date ?? "no due date"}`,
    ),
    "Next: resolve failed or missing feeds, complete linked tasks, then review goals.",
  ].join("\n");
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([reportText], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${site.product_code ?? "product"}-${week}-weekly.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <article className="rounded-lg border p-4 space-y-3">
      <Link
        className="font-semibold text-primary underline"
        to={`/products/${site.id}`}
      >
        {site.product_code} {site.name}
      </Link>
      <p>
        {range.start} → {range.end} · {range.days}/7 완료일
      </p>
      <div className="overflow-x-auto">
        <table className="factory-table">
          <thead>
            <tr>
              <th>지표</th>
              <th>관측 합계</th>
              <th>관측 일수</th>
              <th>직전 주 대비</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((s) => (
              <tr key={s.name}>
                <td>{s.name}</td>
                <td>
                  {s.current.mixed
                    ? "혼합 통화"
                    : (s.current.value ?? "No Data")}{" "}
                  {s.current.currency ?? ""}
                </td>
                <td>
                  {s.current.days}/{range.days}
                </td>
                <td>{s.change}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        기간 고유 사용자 합계를 계산하지 않습니다. Core action의 빈 날짜는 0으로
        간주하지 않습니다. 부분 관측에서는 증감률을 제시하지 않습니다.
      </p>
      <h3 className="font-medium">다음 행동</h3>
      <ul className="list-disc pl-5 text-sm">
        {issues.map((i) => (
          <li key={i.source}>
            {i.source}: {i.health.reason}
          </li>
        ))}
        <li>
          제품의 Launch 체크와 Review 목표를 확인하고 미완료 작업을 처리하세요.
        </li>
      </ul>
      <h3 className="font-medium">이 주의 연결 작업</h3>
      {tasks.length ? (
        tasks.map((t) => (
          <p key={t.id}>
            [{t.status}] {t.title} · {t.owner || "담당 미정"} ·{" "}
            {t.due_date ?? "기한 미정"}
          </p>
        ))
      ) : (
        <p>
          이 주에 연결한 작업이 없습니다. 제품의 Work에서 월요일 날짜를
          지정하세요.
        </p>
      )}
      <Button variant="secondary" onClick={download}>
        Download weekly report
      </Button>
    </article>
  );
}
