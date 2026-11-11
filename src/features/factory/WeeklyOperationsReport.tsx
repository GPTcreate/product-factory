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
import { SOURCE_LABEL } from "@/lib/sources";
import { TASK_STATUS_LABELS } from "./operations-labels";

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
        {view ? "주간 보고서 닫기" : "주간 보고서 열기"}
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
  if (privacy.enabled) return <p>전체 데이터 숨김이 켜져 있습니다.</p>;
  if (range.days === 0) return <p>이 주에는 아직 완료된 날짜가 없습니다.</p>;
  if (metrics.isLoading || operations.isLoading)
    return <p role="status">주간 보고서를 불러오는 중…</p>;
  if (
    metrics.isError ||
    operations.isError ||
    !metrics.data ||
    !operations.data
  )
    return (
      <div role="alert">
        주간 보고서 자료를 불러오지 못했습니다.{" "}
        <Button
          onClick={() => {
            void metrics.refetch();
            void operations.refetch();
          }}
        >
          주간 보고서 다시 확인
        </Button>
      </div>
    );
  const m = metrics.data;
  const series = [
    {
      name: "세션 수",
      rows: m.analytics.map((r) => ({
        metric_date: r.metric_date,
        value: r.sessions,
      })),
    },
    {
      name: "핵심 행동 이벤트 수",
      rows: m.events.map((r) => ({
        metric_date: r.metric_date,
        value: r.event_count,
      })),
    },
    {
      name: "Google 검색 클릭 수",
      rows: m.search
        .filter((r) => r.engine === "google")
        .map((r) => ({ metric_date: r.metric_date, value: r.clicks })),
    },
    {
      name: "Bing 검색 클릭 수",
      rows: m.search
        .filter((r) => r.engine === "bing")
        .map((r) => ({ metric_date: r.metric_date, value: r.clicks })),
    },
    {
      name: "AdSense 수익",
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
  const health = site.statuses.map((s) => ({
    source: s.source,
    health: computeHealth(s),
  }));
  const issues = health.filter((s) =>
    ["warning", "critical", "pending"].includes(s.health.level),
  );
  const disabled = health.filter((s) => s.health.level === "disabled");
  const reportText = [
    `${site.product_code ?? ""} ${site.name}`,
    `${range.start} → ${range.end} · 완료된 ${range.days}일`,
    ...summary.map(
      (s) =>
        `${s.name}: ${s.current.mixed ? "혼합 통화" : (s.current.value ?? "자료 없음")} ${s.current.currency ?? ""}; 관측 ${s.current.days}/${range.days}일; 직전 주 대비 ${s.change}`,
    ),
    ...issues.map((i) => `${SOURCE_LABEL[i.source]}: ${i.health.reason}`),
    ...(disabled.length
      ? [
          `비활성 연결: ${disabled.map((i) => SOURCE_LABEL[i.source]).join(" · ")}`,
        ]
      : []),
    ...tasks.map(
      (t) =>
        `[${TASK_STATUS_LABELS[t.status]}] ${t.title} / ${t.owner || "담당 미정"} / ${t.due_date ?? "기한 미정"}`,
    ),
    "다음: 조치 항목의 수집 상태와 연결 작업을 확인한 뒤 평가 목표를 검토하세요.",
  ].join("\n");
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([reportText], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${site.product_code ?? "제품"}-${week}-주간보고서.txt`;
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
                    : (s.current.value ?? "자료 없음")}{" "}
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
        기간 고유 사용자 합계를 계산하지 않습니다. 핵심 행동 이벤트의 빈 날짜는
        0으로 간주하지 않습니다. 부분 관측에서는 증감률을 제시하지 않습니다.
      </p>
      <h3 className="font-medium">다음 행동</h3>
      <ul className="list-disc pl-5 text-sm">
        {issues.map((i) => (
          <li key={i.source}>
            {SOURCE_LABEL[i.source]}: {i.health.reason}
          </li>
        ))}
        <li>
          제품의 출시 준비 항목과 평가 목표를 확인하고 미완료 작업을 처리하세요.
        </li>
      </ul>
      {disabled.length > 0 && (
        <p className="text-xs text-muted-foreground">
          비활성 연결: {disabled.map((i) => SOURCE_LABEL[i.source]).join(" · ")}
        </p>
      )}
      <h3 className="font-medium">이 주의 연결 작업</h3>
      {tasks.length ? (
        tasks.map((t) => (
          <p key={t.id}>
            [{TASK_STATUS_LABELS[t.status]}] {t.title} ·{" "}
            {t.owner || "담당 미정"} · {t.due_date ?? "기한 미정"}
          </p>
        ))
      ) : (
        <p>
          이 주에 연결한 작업이 없습니다. 제품의 작업 현황에서 월요일 날짜를
          지정하세요.
        </p>
      )}
      <Button variant="secondary" onClick={download}>
        주간 보고서 내려받기
      </Button>
    </article>
  );
}
