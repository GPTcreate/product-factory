import { useRevenue } from "./api";
import { revenueSummary, money, metricState } from "./model";
import { usePrivacyMode } from "@/lib/privacy";
import { ErrorState } from "@/components/ui/error-state";
import type { SiteWithStatuses } from "@/lib/api";
export function RevenuePanel({
  days,
  products,
  productId,
}: {
  days: number;
  products: SiteWithStatuses[];
  productId?: string;
}) {
  const query = useRevenue(days, productId),
    privacy = usePrivacyMode();
  if (query.isLoading)
    return (
      <section className="factory-panel">수익 자료를 불러오는 중…</section>
    );
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  const rows = query.data ?? [],
    summary = revenueSummary(rows);
  const connected = products.some(
    (p) => p.adsense_enabled && p.adsense_mapping_key,
  );
  const display = (v: string) => (privacy.enabled ? "********" : v);
  const rankings = products
    .map((p) => ({
      p,
      s: revenueSummary(rows.filter((r) => r.product_id === p.id)),
    }))
    .sort((a, b) => (b.s.earnings ?? -Infinity) - (a.s.earnings ?? -Infinity));
  return (
    <section className="factory-panel space-y-4" id="revenue">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">광고 수익 · 최근 {days}일</h2>
        <span className="text-xs text-muted-foreground">
          예상 수익 · AdSense 계정 시간대 기준
        </span>
      </div>
      {summary.mixedCurrency && (
        <p role="alert" className="text-critical">
          통화가 여러 종류여서 총수익과 1,000회 조회당 수익을 합산할 수
          없습니다.
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          [
            "수익",
            metricState(
              connected || rows.length > 0,
              summary.hasData,
              money(summary.earnings, summary.currency),
            ),
          ],
          [
            "1,000회 조회당 수익",
            summary.rpm === null
              ? "자료 없음"
              : money(summary.rpm, summary.currency),
          ],
          [
            "광고 클릭 수",
            metricState(
              connected || rows.length > 0,
              summary.hasData,
              String(summary.clicks),
            ),
          ],
          [
            "광고 노출 수",
            metricState(
              connected || rows.length > 0,
              summary.hasData,
              summary.impressions.toLocaleString(),
            ),
          ],
        ].map(([label, v]) => (
          <div key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold">
              {display(!connected && !rows.length ? "연결 안 됨" : v)}
            </p>
          </div>
        ))}
      </div>
      {!connected && !rows.length && (
        <p className="text-sm text-muted-foreground">
          제품 설정에 확인된 AdSense 사이트 도메인을 입력하고 계정을 연결한 뒤
          수집을 실행하세요.
        </p>
      )}
      {connected && !rows.length && (
        <p className="text-sm text-muted-foreground">
          아직 저장된 보고서 자료가 없습니다. 수집 이력을 확인하세요. 자료가
          없다는 것은 수익이 0이라는 뜻이 아닙니다.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="factory-table">
          <thead>
            <tr>
              <th>제품</th>
              <th>수익</th>
              <th>페이지 조회 수</th>
              <th>클릭 수</th>
              <th>페이지 클릭률</th>
              <th>1,000회 조회당 수익</th>
              <th>광고 게재 비율</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map(({ p, s }) => (
              <tr key={p.id}>
                <td>
                  {privacy.maskText(`${p.product_code ?? ""} ${p.name}`)}
                  {!p.adsense_enabled && s.hasData && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      과거 자료 · 현재 연결 해제
                    </span>
                  )}
                </td>
                <td>
                  {display(
                    metricState(
                      !!p.adsense_enabled || s.hasData,
                      s.hasData,
                      money(s.earnings, s.currency),
                    ),
                  )}
                </td>
                <td>{display(s.hasData ? s.views.toLocaleString() : "—")}</td>
                <td>{display(s.hasData ? String(s.clicks) : "—")}</td>
                <td>
                  {display(
                    s.ctr === null ? "—" : (s.ctr * 100).toFixed(2) + "%",
                  )}
                </td>
                <td>
                  {display(s.rpm === null ? "—" : money(s.rpm, s.currency))}
                </td>
                <td>
                  {display(
                    s.coverage === null
                      ? "—"
                      : (s.coverage * 100).toFixed(1) + "%",
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {productId && rows.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-primary">
            일별 보고서 ({rows.length}일)
          </summary>
          <div className="mt-3 max-h-80 overflow-auto">
            <table className="factory-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>수익</th>
                  <th>조회 수</th>
                  <th>클릭 수</th>
                  <th>광고 요청 수</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((r) => (
                  <tr key={r.metric_date}>
                    <td>{r.metric_date}</td>
                    <td>
                      {display(money(r.estimated_earnings, r.currency_code))}
                    </td>
                    <td>{display(String(r.page_views))}</td>
                    <td>{display(String(r.clicks))}</td>
                    <td>{display(String(r.ad_requests))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <p className="text-xs text-muted-foreground">
        클릭률은 클릭 수를 AdSense 페이지 조회 수로 나눈 값입니다. 1,000회
        조회당 수익과 광고 게재 비율은 합계에서 다시 계산합니다. 마지막 저장일:{" "}
        {rows.at(-1)?.metric_date ?? "자료 없음"}.
      </p>
    </section>
  );
}
