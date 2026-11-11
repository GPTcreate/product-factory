import { useAnalyticsDetail } from "./api";
import { metricState } from "./model";
import { usePrivacyMode } from "@/lib/privacy";
import { ErrorState } from "@/components/ui/error-state";
import type { SiteWithStatuses } from "@/lib/api";
const EVENT_LABELS: Record<string, string> = {
  core_action: "핵심 행동",
  result_view: "결과 조회",
  share: "공유",
  outbound_click: "외부 링크 클릭",
  signup: "회원가입",
  premium_view: "유료 기능 조회",
  checkout_start: "결제 시작",
  purchase: "구매",
};
const DEVICE_LABELS: Record<string, string> = {
  desktop: "컴퓨터",
  mobile: "휴대전화",
  tablet: "태블릿",
  other: "기타",
  unknown: "알 수 없음",
};
export function AnalyticsDetail({
  site,
  days,
  section,
}: {
  site: SiteWithStatuses;
  days: number;
  section: "traffic" | "events" | "search";
}) {
  const query = useAnalyticsDetail(site.id, days),
    privacy = usePrivacyMode();
  if (query.isLoading) return <p>상세 자료를 불러오는 중…</p>;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  const data = query.data!;
  const display = (text: string) => (privacy.enabled ? "********" : text);
  if (section === "traffic")
    return (
      <section className="factory-panel">
        <h2 className="font-semibold">방문자·참여 현황</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            [
              "신규 사용자 수 (일별 합계)",
              data.audience.reduce((s, r) => s + r.new_users, 0),
            ],
            [
              "재방문 사용자 수 (일별 합계)",
              data.audience.reduce((s, r) => s + r.returning_users, 0),
            ],
            [
              "참여 시간 (초)",
              data.audience.reduce(
                (s, r) => s + Number(r.engagement_seconds),
                0,
              ),
            ],
          ].map(([label, n]) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-semibold">
                {display(
                  metricState(
                    !!site.ga4_property_id,
                    !!data.audience.length,
                    Number(n).toLocaleString(),
                  ),
                )}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          일별 사용자 수의 합계이며, 기간 전체의 중복을 제거한 사용자 수가
          아닙니다. 재방문자는 GA4의 newVsReturning = returning 값을 사용하며
          뺄셈으로 추정하지 않습니다.
        </p>
      </section>
    );
  if (section === "events") {
    const counts = new Map<string, number>();
    data.events.forEach((r) =>
      counts.set(r.event_name, (counts.get(r.event_name) ?? 0) + r.event_count),
    );
    const names = [
      ...new Set([
        "core_action",
        "result_view",
        "share",
        "outbound_click",
        "signup",
        "premium_view",
        "checkout_start",
        "purchase",
        ...counts.keys(),
      ]),
    ];
    return (
      <section className="factory-panel">
        <h2 className="font-semibold">이벤트 · 최근 {days}일</h2>
        <p className="my-2 text-sm text-muted-foreground">
          GA4에서 수신한 공통 이벤트와 제품별 이벤트입니다.
        </p>
        <table className="factory-table">
          <thead>
            <tr>
              <th>이벤트</th>
              <th>횟수</th>
            </tr>
          </thead>
          <tbody>
            {names.map((name) => (
              <tr key={name}>
                <td>
                  {EVENT_LABELS[name] ? (
                    <>
                      {EVENT_LABELS[name]}{" "}
                      <code className="text-xs text-muted-foreground">
                        ({name})
                      </code>
                    </>
                  ) : (
                    name
                  )}
                </td>
                <td>
                  {display(
                    metricState(
                      !!site.ga4_property_id,
                      counts.has(name),
                      String(counts.get(name)),
                    ),
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {(["country", "device"] as const).map((d) => {
        const grouped = new Map<
          string,
          { clicks: number; impressions: number; position: number }
        >();
        data.search
          .filter((r) => r.dimension === d)
          .forEach((r) => {
            const row = grouped.get(r.value) ?? {
              clicks: 0,
              impressions: 0,
              position: 0,
            };
            row.clicks += r.clicks;
            row.impressions += r.impressions;
            row.position += (r.average_position ?? 0) * r.impressions;
            grouped.set(r.value, row);
          });
        return (
          <section key={d} className="factory-panel overflow-x-auto">
            <h2 className="mb-3 font-semibold">
              Google 검색 · {d === "country" ? "국가" : "기기"}
            </h2>
            {!grouped.size ? (
              <p>{site.gsc_property ? "자료 없음" : "연결 안 됨"}</p>
            ) : (
              <table className="factory-table">
                <thead>
                  <tr>
                    <th>{d === "country" ? "국가" : "기기"}</th>
                    <th>클릭 수</th>
                    <th>노출 수</th>
                    <th>클릭률</th>
                    <th>평균 순위</th>
                  </tr>
                </thead>
                <tbody>
                  {[...grouped]
                    .sort((a, b) => b[1].clicks - a[1].clicks)
                    .slice(0, 50)
                    .map(([value, r]) => (
                      <tr key={value}>
                        <td>
                          {d === "device"
                            ? (DEVICE_LABELS[value.toLowerCase()] ?? value)
                            : value}
                        </td>
                        <td>{display(String(r.clicks))}</td>
                        <td>{display(String(r.impressions))}</td>
                        <td>
                          {display(
                            r.impressions
                              ? ((r.clicks / r.impressions) * 100).toFixed(2) +
                                  "%"
                              : "—",
                          )}
                        </td>
                        <td>
                          {display(
                            r.impressions
                              ? (r.position / r.impressions).toFixed(1)
                              : "—",
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </div>
  );
}
