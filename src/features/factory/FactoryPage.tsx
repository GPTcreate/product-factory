import { useState } from "react";
import { Link } from "react-router-dom";
import { useSites, useSaveSite } from "@/lib/hooks";
import { useWeeks, useFactoryMutation } from "./api";
import { monday, isoWeek, seoulDate } from "./model";
import {
  PRODUCT_STATUSES,
  type FactoryWeek,
} from "../../../supabase/functions/_shared/product";
import type { SiteWithStatuses } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { usePrivacyMode } from "@/lib/privacy";
import { WeeklyOperationsReport } from "./WeeklyOperationsReport";
import { PRODUCT_STATUS_LABELS } from "./operations-labels";
export function FactoryPage() {
  const products = useSites(),
    weeks = useWeeks(),
    privacy = usePrivacyMode();
  const [week, setWeek] = useState(monday());
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-primary">
          출시 · 측정 · 판단
        </p>
        <h1 className="mt-2 text-2xl font-semibold">주간 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isoWeek()}주차 · 올해 출시한 실험{" "}
          {products.data?.filter((p) =>
            p.launch_date?.startsWith(seoulDate().slice(0, 4)),
          ).length ?? 0}{" "}
          / 72개 · 52주 운영 주기
        </p>
      </header>
      <label className="block max-w-xs text-sm">
        기준 주 시작일 (월요일, 한국 시간)
        <input
          type="date"
          className="factory-input"
          value={week}
          onChange={(e) => {
            if (e.target.value) setWeek(monday(e.target.value));
          }}
        />
      </label>
      {(products.isLoading || weeks.isLoading) && (
        <p role="status">주간 관리 자료를 불러오는 중…</p>
      )}
      {(products.isError || weeks.isError) && (
        <ErrorState
          onRetry={() => {
            void products.refetch();
            void weeks.refetch();
          }}
        />
      )}
      {products.data && weeks.data && (
        <WeekEditor
          key={
            week +
            ":" +
            (weeks.data.find((w) => w.week_start === week)?.updated_at ?? "new")
          }
          week={
            weeks.data.find((w) => w.week_start === week) ?? {
              week_start: week,
              product_id: null,
              notes: "",
              hypothesis: "",
              success_metric: "",
              result: "",
              decision: "",
              updated_at: "",
            }
          }
          products={products.data}
        />
      )}
      <h2 className="font-semibold">제품 진행 현황</h2>
      {products.data && (
        <WeeklyOperationsReport sites={products.data} week={week} />
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PRODUCT_STATUSES.map((status) => (
          <section key={status} className="rounded-xl border bg-muted/40 p-3">
            <h3 className="mb-3 flex justify-between text-xs font-semibold">
              {PRODUCT_STATUS_LABELS[status]}
              <span>
                {products.data?.filter((p) => (p.status ?? "LIVE") === status)
                  .length ?? 0}
              </span>
            </h3>
            <div className="space-y-3">
              {products.data
                ?.filter((p) => (p.status ?? "LIVE") === status)
                .map((p) => (
                  <PipelineCard key={p.id} product={p} />
                ))}
            </div>
          </section>
        ))}
      </div>
      <section className="factory-panel">
        <h2 className="mb-3 font-semibold">실험 기록</h2>
        {weeks.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            이번 주의 가설을 저장하면 실험 기록이 시작됩니다.
          </p>
        )}
        <div className="space-y-3">
          {weeks.data?.map((w) => (
            <button
              key={w.week_start}
              className="block w-full rounded-lg border p-3 text-left hover:bg-muted"
              onClick={() => setWeek(w.week_start)}
            >
              <span className="text-xs text-muted-foreground">
                {w.week_start}
              </span>
              <p className="font-medium">
                {privacy.maskText(w.hypothesis) || "아직 가설이 없습니다"}
              </p>
              <p className="text-sm text-muted-foreground">
                {privacy.maskText(w.decision || w.result || "결과 대기 중")}
              </p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
function PipelineCard({ product: p }: { product: SiteWithStatuses }) {
  const mutation = useSaveSite(),
    privacy = usePrivacyMode();
  return (
    <div className="rounded-lg border bg-card p-3">
      <span className="text-xs text-muted-foreground">
        {p.product_code ?? "코드 미지정"} · 단계 {p.level ?? 1}
      </span>
      <Link className="mt-1 block font-medium" to={`/products/${p.id}`}>
        {privacy.maskText(p.name)}
      </Link>
      <select
        aria-label={`${p.name} 사업 상태`}
        className="factory-input"
        disabled={mutation.isPending}
        value={p.status ?? "LIVE"}
        onChange={(e) =>
          mutation.mutate({
            action: "update",
            id: p.id,
            values: {
              ...p,
              status: e.target.value as typeof p.status,
              gsc_property: p.gsc_property ?? "",
              ga4_property_id: p.ga4_property_id ?? "",
              bing_site_url: p.bing_site_url ?? "",
            },
          })
        }
      >
        {PRODUCT_STATUSES.map((v) => (
          <option key={v} value={v}>
            {PRODUCT_STATUS_LABELS[v]}
          </option>
        ))}
      </select>
      {mutation.isError && (
        <p role="alert" className="text-xs text-critical">
          사업 상태를 저장하지 못했습니다.
        </p>
      )}
    </div>
  );
}
function WeekEditor({
  week,
  products,
}: {
  week: FactoryWeek;
  products: SiteWithStatuses[];
}) {
  const [value, setValue] = useState(week),
    mutation = useFactoryMutation();
  return (
    <form
      className="factory-panel space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate({ action: "week.save", values: value });
      }}
    >
      <fieldset disabled={mutation.isPending} className="min-w-0 space-y-4">
        <h2 className="font-semibold">이번 주 집중할 일</h2>
        <label className="block text-sm">
          제품
          <select
            className="factory-input"
            aria-label="이번 주 제품"
            value={value.product_id ?? ""}
            onChange={(e) => {
              mutation.reset();
              setValue({ ...value, product_id: e.target.value || null });
            }}
          >
            <option value="">제품 선택</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.product_code} · {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["hypothesis", "실험 가설"],
            ["success_metric", "성공 지표·목표"],
            ["result", "관측한 결과"],
            ["decision", "판단: 유지·관찰 / 중단 / 개선 / 확대 / 다음 버전"],
            ["notes", "주간 메모"],
          ].map(([key, label]) => (
            <label className="text-sm" key={key}>
              {label}
              <textarea
                rows={2}
                maxLength={5000}
                className="factory-input"
                value={value[key as "notes"]}
                onChange={(e) => {
                  mutation.reset();
                  setValue({ ...value, [key]: e.target.value });
                }}
              />
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          판단은 메모로 저장합니다. 제품의 사업 상태는 위의 진행 현황에서 직접
          변경하세요.
        </p>
        {mutation.isError && (
          <p role="alert" className="text-critical">
            {mutation.error.message}
          </p>
        )}
        {mutation.isSuccess && (
          <p role="status" className="text-success">
            저장했습니다.
          </p>
        )}
        <Button loading={mutation.isPending}>이번 주 기록 저장</Button>
      </fieldset>
    </form>
  );
}
