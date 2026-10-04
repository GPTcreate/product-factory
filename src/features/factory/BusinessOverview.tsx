import { Link } from "react-router-dom";
import { PRODUCT_STATUSES } from "../../../supabase/functions/_shared/product";
import { isoWeek, seoulDate } from "./model";
import { RevenuePanel } from "./RevenuePanel";
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
              Build a portfolio that compounds.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {products.length} products · Week {isoWeek()} · {launched} / 72
              launches in {year}
            </p>
          </div>
          <Link
            to="/factory"
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Open factory →
          </Link>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {PRODUCT_STATUSES.map((status) => (
            <span key={status} className="factory-tag">
              {status}{" "}
              <b className="ml-2">
                {products.filter((p) => (p.status ?? "LIVE") === status).length}
              </b>
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          52-week cadence · up to 72 V1 experiments. Only products with a launch
          date count toward the annual target.
        </p>
      </section>
      <RevenuePanel days={days} products={products} />
    </div>
  );
}
