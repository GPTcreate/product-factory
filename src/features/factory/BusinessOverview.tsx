import { Link } from "react-router-dom";
import { PRODUCT_STATUSES } from "../../../supabase/functions/_shared/product";
import { isoWeek, seoulDate } from "./model";
import { RevenuePanel } from "./RevenuePanel";
import { PRODUCT_STATUS_LABELS } from "./operations-labels";
import type { SiteWithStatuses } from "@/lib/api";
export function BusinessOverview({
  products,
  days,
}: {
  products: SiteWithStatuses[];
  days: number;
}) {
  const year = seoulDate().slice(0, 4),
    launched = products.filter((p) => p.launch_date?.startsWith(year)).length;
  return (
    <div className="space-y-4">
      <section className="factory-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Product Factory · v0.1
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              제품을 만들고, 성과를 쌓아가세요.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              제품 {products.length}개 · {isoWeek()}주차 · {year}년 출시{" "}
              {launched} / 72개
            </p>
          </div>
          <Link
            to="/factory"
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            주간 관리 열기 →
          </Link>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {PRODUCT_STATUSES.map((status) => (
            <span key={status} className="factory-tag">
              {PRODUCT_STATUS_LABELS[status]}{" "}
              <b className="ml-2">
                {products.filter((p) => (p.status ?? "LIVE") === status).length}
              </b>
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          52주 동안 최대 72개의 첫 버전 실험을 진행합니다. 출시일이 있는 제품만
          연간 목표에 집계합니다.
        </p>
      </section>
      <RevenuePanel days={days} products={products} />
    </div>
  );
}
