import { dataAvailability } from "@/features/factory/model";
import { useInsights } from "@/lib/hooks";
import { ComparisonTable } from "@/features/dashboard/ComparisonTable";
import { RevenuePanel } from "@/features/factory/RevenuePanel";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useSites } from "@/lib/hooks";
import { computeHealth } from "@/lib/health";
import { SOURCES, SOURCE_SHORT } from "@/lib/sources";
import { relativeTime } from "@/lib/dates";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HealthBadge } from "@/components/status/HealthBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SiteFormDialog } from "@/features/sites/SiteFormDialog";
import { usePrivacyMode } from "@/lib/privacy";

export function SitesPage() {
  const privacy = usePrivacyMode();
  const insights = useInsights(30);
  const { data: sites, isLoading, isError, refetch } = useSites();
  const [adding, setAdding] = useState(false);
  const [p001, setP001] = useState(false);
  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your product portfolio, lifecycle and integration health.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setP001(false);
            setAdding(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add product
        </Button>
      </div>

      {sites &&
        !sites.some(
          (s) => s.product_code === "P001" || s.domain === "iposcore.kr",
        ) && (
          <Button
            variant="secondary"
            onClick={() => {
              setP001(true);
              setAdding(true);
            }}
          >
            Register P001 · IPOScore
          </Button>
        )}

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      )}

      {isError && <ErrorState onRetry={() => void refetch()} />}

      {sites && sites.length === 0 && (
        <EmptyState
          title="No products yet"
          description="Add your first product to start tracking its metrics."
          action={
            <Button
              size="sm"
              onClick={() => {
                setP001(false);
                setAdding(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add product
            </Button>
          }
        />
      )}

      {sites && sites.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {sites.map((site) => (
            <Link key={site.id} to={`/products/${site.id}`} className="block">
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardContent className="space-y-3 p-4">
                  <div>
                    <p className="font-medium">
                      {privacy.maskText(site.name, `site:${site.id}:name`)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {privacy.maskText(site.domain, `site:${site.id}:domain`)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="factory-tag">
                      {site.product_code ?? "Unassigned"}
                    </span>
                    <span className="factory-tag">{site.status ?? "LIVE"}</span>
                    <span className="factory-tag">
                      {site.market ?? "Global"} · L{site.level ?? 1} · v
                      {site.version ?? "1.0"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {SOURCES.map((source) => {
                      const status = site.statuses.find(
                        (s) => s.source === source,
                      );
                      if (!status) return null;
                      const health = computeHealth(status, now);
                      return (
                        <div key={source} className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">
                            {SOURCE_SHORT[source]}
                          </span>
                          <HealthBadge health={health} />
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last success{" "}
                    {privacy.enabled
                      ? "********"
                      : relativeTime(
                          site.statuses
                            .map((s) => s.last_success_at)
                            .filter((d): d is string => !!d)
                            .sort()
                            .at(-1),
                        )}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {insights.data && (
        <section className="space-y-3">
          <h2 className="font-semibold">Product KPI comparison · 30 days</h2>
          <ComparisonTable
            sites={insights.data.sites}
            missing={
              dataAvailability(
                insights.data.sitesWithStatuses,
                insights.data.raw,
                30,
              ).products
            }
          />
        </section>
      )}
      {sites && sites.length > 0 && <RevenuePanel days={30} products={sites} />}
      {adding && (
        <SiteFormDialog
          mode="create"
          preset={
            p001
              ? {
                  product_code: "P001",
                  name: "IPOScore",
                  domain: "iposcore.kr",
                  website_url: "https://iposcore.kr",
                  market: "Korea",
                  primary_language: "ko",
                  level: 1,
                  status: "LIVE",
                  deploy_url: "https://iposcore.kr",
                }
              : undefined
          }
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}
