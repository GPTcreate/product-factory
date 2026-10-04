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
export function FactoryPage() {
  const products = useSites(),
    weeks = useWeeks(),
    privacy = usePrivacyMode();
  const [week, setWeek] = useState(monday());
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-primary">
          Ship · measure · decide
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Factory</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Week {isoWeek()} ·{" "}
          {products.data?.filter((p) =>
            p.launch_date?.startsWith(seoulDate().slice(0, 4)),
          ).length ?? 0}{" "}
          / 72 experiments launched this year · 52-week cadence
        </p>
      </header>
      <label className="block max-w-xs text-sm">
        Week starting (Monday, Korea time)
        <input
          type="date"
          className="factory-input"
          value={week}
          onChange={(e) => {
            if (e.target.value) setWeek(monday(e.target.value));
          }}
        />
      </label>
      {(products.isLoading || weeks.isLoading) && <p>Loading factory…</p>}
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
      <h2 className="font-semibold">Product pipeline</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PRODUCT_STATUSES.map((status) => (
          <section key={status} className="rounded-xl border bg-muted/40 p-3">
            <h3 className="mb-3 flex justify-between text-xs font-semibold">
              {status}
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
        <h2 className="mb-3 font-semibold">Experiment log</h2>
        {weeks.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Save a weekly hypothesis to start the log.
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
                {privacy.maskText(w.hypothesis) || "No hypothesis yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                {privacy.maskText(w.decision || w.result || "Awaiting results")}
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
        {p.product_code ?? "Unassigned"} · L{p.level ?? 1}
      </span>
      <Link className="mt-1 block font-medium" to={`/products/${p.id}`}>
        {privacy.maskText(p.name)}
      </Link>
      <select
        aria-label={`Status for ${p.name}`}
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
          <option key={v}>{v}</option>
        ))}
      </select>
      {mutation.isError && (
        <p role="alert" className="text-xs text-critical">
          Status was not saved.
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
      <h2 className="font-semibold">Current focus</h2>
      <label className="block text-sm">
        Product
        <select
          className="factory-input"
          aria-label="Current week product"
          value={value.product_id ?? ""}
          onChange={(e) =>
            setValue({ ...value, product_id: e.target.value || null })
          }
        >
          <option value="">Choose product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.product_code} · {p.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["hypothesis", "Experiment hypothesis"],
          ["success_metric", "Success metric / target"],
          ["result", "Observed results"],
          ["decision", "Decision: HOLD / KILL / IMPROVE / SCALE / V2"],
          ["notes", "Weekly notes"],
        ].map(([key, label]) => (
          <label className="text-sm" key={key}>
            {label}
            <textarea
              rows={2}
              maxLength={5000}
              className="factory-input"
              value={value[key as "notes"]}
              onChange={(e) => setValue({ ...value, [key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Decisions are notes. Use the pipeline selector to update product status
        explicitly.
      </p>
      {mutation.isError && (
        <p role="alert" className="text-critical">
          {mutation.error.message}
        </p>
      )}
      {mutation.isSuccess && (
        <p role="status" className="text-success">
          Saved.
        </p>
      )}
      <Button loading={mutation.isPending}>Save week</Button>
    </form>
  );
}
