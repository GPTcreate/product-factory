import { spawn } from "node:child_process";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const folder = ".agent/evidence/development-resume-20261008";
await mkdir(folder, { recursive: true });
const origin = "http://127.0.0.1:5188";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5188",
    "--strictPort",
  ],
  {
    stdio: "ignore",
    env: {
      ...process.env,
      FACTORY_FIXTURE_ONLY: "1",
      VITE_SUPABASE_URL: "https://fixture.supabase.test",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
      VITE_APP_URL: origin,
    },
  },
);
let browser;
try {
  for (let n = 0; n < 50; n++) {
    try {
      if ((await fetch(`${origin}/tests/browser/index.html`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Any outbound browser request outside the fixture or local server is refused.
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.hostname !== "fixture.supabase.test") return route.abort();
    if (route.request().method() === "OPTIONS")
      return route.fulfill({
        status: 200,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "GET, OPTIONS",
        },
      });
    assert.equal(route.request().method(), "GET");
    const now = new Date().toISOString(),
      date = now.slice(0, 10);
    const site = {
      id: "fixture",
      name: "Diagnostic fixture",
      domain: "example.com",
      website_url: "https://example.com",
      product_code: "P999",
      status: "LIVE",
      is_active: false,
      adsense_enabled: false,
    };
    const statuses = ["ga4", "gsc", "bing", "adsense"].map((source) => ({
      site_id: site.id,
      source,
      enabled: source !== "adsense",
      last_status: source === "gsc" ? null : "success",
      last_attempt_at: source === "gsc" ? null : now,
      last_success_at: source === "gsc" ? null : now,
      last_rows_written: source === "bing" ? 0 : 1,
      last_rows_fetched: 1,
      consecutive_failures: 0,
      last_error_code: null,
      stale_after_hours: 36,
    }));
    const run = {
      id: "run-zero",
      site_id: site.id,
      source: "bing",
      status: "success",
      started_at: now,
      finished_at: now,
      range_start: date,
      range_end: date,
      rows_written: 0,
      rows_fetched: 0,
      trigger_type: "manual",
      error_code: null,
      error_message: null,
      metadata: {},
      duration_ms: 1,
    };
    const table = url.pathname.split("/").at(-1);
    let data =
      {
        sites: [site],
        integration_status: statuses,
        analytics_daily: [{ site_id: site.id, metric_date: date, sessions: 0 }],
        sync_runs: [run],
      }[table] ?? [];
    if (url.searchParams.has("source"))
      data = data.filter(
        (r) => r.source === url.searchParams.get("source").slice(3),
      );
    if (route.request().headers().accept?.includes("vnd.pgrst.object"))
      data = data[0] ?? null;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(data),
    });
  });
  await page.goto(`${origin}/tests/browser/index.html`);
  await page.getByRole("link", { name: "Products", exact: true }).click();
  await page
    .getByRole("link", { name: "Diagnostic fixture", exact: true })
    .click();
  const panel = page.getByRole("region", { name: "Connection diagnostics" });
  await panel
    .getByText("Analytics · Stored zero measurement", { exact: true })
    .waitFor();
  await panel
    .getByText("Bing · Success with 0 rows", { exact: true })
    .waitFor();
  await panel
    .getByText("Search Console · Not run yet", { exact: true })
    .waitFor();
  await panel.getByText("AdSense · Not configured", { exact: true }).waitFor();
  await panel.screenshot({ path: `${folder}/F02-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth));
  await panel.screenshot({ path: `${folder}/F02-mobile.png` });
  await panel
    .getByRole("link", { name: "Inspect Bing run, period and error" })
    .click();
  const detail = page.getByRole("dialog", { name: "Sync run detail" });
  await detail.waitFor();
  await detail.getByText("Requested range", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("runId"), "run-zero");
  await detail.getByRole("button", { name: "Close", exact: true }).click();
  assert.equal(new URL(page.url()).searchParams.get("runId"), null);
  assert.deepEqual(errors, []);
  const evidence = {
    passed: true,
    syntheticOnly: true,
    actualSync: false,
    desktop: true,
    mobile: true,
    runNavigation: true,
    independentlyApproved: false,
  };
  await writeFile(
    `${folder}/F02-browser.json`,
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence));
} finally {
  await browser?.close();
  server.kill();
}
