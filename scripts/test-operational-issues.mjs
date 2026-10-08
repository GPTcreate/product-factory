import { spawn } from "node:child_process";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const folder = ".agent/evidence/development-resume-20261008";
const origin = "http://127.0.0.1:5190";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5190",
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
  const now = new Date().toISOString(),
    date = now.slice(0, 10);
  const sites = ["Evidence", "Failures", "Unverified"].map((name, index) => ({
    id: String(index),
    name,
    domain: `fixture${index}.example.com`,
    website_url: `https://fixture${index}.example.com`,
    product_code: `P90${index}`,
    is_active: false,
    status: "LIVE",
  }));
  const sources = ["ga4", "gsc", "bing", "adsense"];
  const modes = [
    ["zero", "empty", "never", "disabled"],
    ["partial", "failed", "stale", "missing"],
    ["running", "absent", "present", "present"],
  ];
  const statuses = sites.flatMap((site, index) =>
    sources.flatMap((source, n) => {
      const mode = modes[index][n];
      if (mode === "absent") return [];
      return [
        {
          site_id: site.id,
          source,
          enabled: mode !== "disabled",
          last_status: ["partial", "failed", "running"].includes(mode)
            ? mode
            : mode === "never"
              ? null
              : "success",
          last_attempt_at: mode === "never" ? null : now,
          last_success_at:
            mode === "never"
              ? null
              : mode === "stale"
                ? "2026-01-01T00:00:00Z"
                : now,
          consecutive_failures: mode === "failed" ? 2 : 0,
          stale_after_hours: 36,
          last_rows_written: mode === "empty" ? 0 : 1,
          last_error_code: mode === "failed" ? "provider_error" : null,
        },
      ];
    }),
  );
  const runs = statuses
    .filter((s) => s.last_status)
    .map((s) => ({
      id: `run-${s.site_id}-${s.source}`,
      site_id: s.site_id,
      source: s.source,
      status: s.last_status,
      started_at: now,
      finished_at: s.last_status === "running" ? null : now,
      range_start: date,
      range_end: date,
      rows_written: s.last_rows_written,
      rows_fetched: s.last_rows_written,
      error_code: s.last_error_code,
      error_message: null,
      trigger_type: "manual",
      metadata: {},
      duration_ms: 1,
    }));
  let writes = 0,
    rejectedOutbound = 0,
    failRead = false;
  await page.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (url.hostname !== "fixture.supabase.test") {
      rejectedOutbound++;
      return route.abort();
    }
    if (!["GET", "OPTIONS"].includes(request.method())) {
      writes++;
      return route.abort();
    }
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
    };
    const table = url.pathname.split("/").at(-1);
    if (failRead && table === "analytics_daily")
      return route.fulfill({
        status: 500,
        headers,
        contentType: "application/json",
        body: JSON.stringify({ message: "Fixture read failure" }),
      });
    let data =
      {
        sites,
        integration_status: statuses,
        sync_runs: runs,
        analytics_daily: [{ site_id: "0", metric_date: date, sessions: 0 }],
        search_daily: [
          { site_id: "2", metric_date: date, engine: "bing", clicks: 1 },
        ],
        adsense_daily_metrics: [
          { product_id: "2", metric_date: date, estimated_earnings: 1 },
        ],
      }[table] ?? [];
    for (const key of ["id", "site_id", "source", "product_id"])
      if (url.searchParams.get(key)?.startsWith("eq."))
        data = data.filter(
          (row) => row[key] === url.searchParams.get(key).slice(3),
        );
    if (request.headers().accept?.includes("vnd.pgrst.object"))
      data = data[0] ?? null;
    return route.fulfill({
      status: 200,
      headers,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  const open = async () => {
    await page.goto(`${origin}/tests/browser/index.html`);
    await page.getByRole("link", { name: "Products", exact: true }).click();
  };
  await open();
  const panel = page.getByRole("region", {
    name: "Operational issues",
    exact: true,
  });
  const evidence = panel.getByRole("region", {
    name: "Issues for Evidence",
    exact: true,
  });
  await evidence
    .getByText("3 issues · 0 unverified · 1 normal measurements", {
      exact: true,
    })
    .waitFor();
  for (const title of [
    "Success with 0 rows",
    "Not run yet",
    "Not configured",
    "Partial collection",
    "Collection failed",
    "Delayed collection",
    "No stored metrics in period",
    "Running",
    "Unverified",
  ])
    await panel.getByText(title, { exact: true }).first().waitFor();
  assert.equal(
    await panel
      .getByRole("region", { name: "Issues for Failures", exact: true })
      .getByRole("article")
      .count(),
    4,
  );
  await mkdir(folder, { recursive: true });
  await panel.screenshot({ path: `${folder}/F04-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth));
  await panel.screenshot({ path: `${folder}/F04-mobile.png` });
  await evidence
    .getByRole("link", {
      name: "Inspect Search Console run, period and error",
      exact: true,
    })
    .click();
  const detail = page.getByRole("dialog", { name: "Sync run detail" });
  await detail.waitFor();
  assert.equal(new URL(page.url()).searchParams.get("runId"), "run-0-gsc");
  await detail.getByRole("button", { name: "Close", exact: true }).click();
  failRead = true;
  await open();
  await panel
    .getByRole("region", { name: "Issues for Evidence", exact: true })
    .getByText("1 issues · 3 unverified · 0 normal measurements", {
      exact: true,
    })
    .waitFor();
  await panel
    .getByRole("button", { name: "Retry evidence read" })
    .first()
    .waitFor();
  failRead = false;
  await panel
    .getByRole("button", { name: "Retry evidence read" })
    .first()
    .click();
  await evidence
    .getByText("3 issues · 0 unverified · 1 normal measurements", {
      exact: true,
    })
    .waitFor();
  assert.equal(writes, 0);
  assert.equal(rejectedOutbound, 0);
  assert.deepEqual(errors, []);
  const result = {
    passed: true,
    syntheticOnly: true,
    writes,
    rejectedOutbound,
    desktop: true,
    mobile: true,
    deduplicated: true,
    normalAndUnknownSeparated: true,
    originalRunNavigation: true,
    readFailureAndRetry: true,
    independentlyApproved: false,
  };
  await writeFile(
    `${folder}/F04-browser.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser?.close();
  server.kill();
}
