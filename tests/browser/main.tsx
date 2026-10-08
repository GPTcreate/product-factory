// Local test harness only. Not included by Vite's production index.html.
import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { IdeasPage } from "../../src/features/factory/IdeasPage";
import { FactoryPage } from "../../src/features/factory/FactoryPage";
import { SitesPage } from "../../src/features/sites/SitesPage";
import { SiteDetailPage } from "../../src/features/sites/SiteDetailPage";
import { SyncRunsPage } from "../../src/features/sync-runs/SyncRunsPage";
import { OverviewPage } from "../../src/features/dashboard/OverviewPage";
import "../../src/index.css";
const qc = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={qc}>
    <BrowserRouter>
      <div className="min-h-screen md:flex">
        <aside className="w-60 shrink-0 border-r bg-card p-5">
          <p className="mb-8 font-semibold">Product Factory</p>
          <nav className="space-y-4">
            {[
              ["/tests/browser/index.html", "Overview"],
              ["/products", "Products"],
              ["/ideas", "Ideas"],
              ["/factory", "Factory"],
            ].map(([to, label]) => (
              <Link className="block text-sm" key={to} to={to}>
                {label}
              </Link>
            ))}
          </nav>
          <p className="mt-10 text-xs text-muted-foreground">
            Synthetic fixture · local only
          </p>
        </aside>
        <main className="min-w-0 flex-1 p-6">
          <Routes>
            <Route
              path="/tests/browser/index.html"
              element={<OverviewPage />}
            />
            <Route path="/products" element={<SitesPage />} />
            <Route path="/products/:siteId" element={<SiteDetailPage />} />
            <Route path="/sync-runs" element={<SyncRunsPage />} />
            <Route path="/ideas" element={<IdeasPage />} />
            <Route path="/factory" element={<FactoryPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  </QueryClientProvider>,
);
