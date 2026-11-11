import { spawn } from "node:child_process";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5187",
    "--strictPort",
  ],
  {
    env: {
      ...process.env,
      FACTORY_FIXTURE_ONLY: "1",
      VITE_SUPABASE_URL: "https://fixture.supabase.test",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
      VITE_APP_URL: "http://localhost:5173",
    },
    stdio: "ignore",
  },
);
process.on("exit", () => server.kill());
for (let i = 0; i < 50; i++) {
  try {
    if ((await fetch("http://127.0.0.1:5187/tests/browser/index.html")).ok)
      break;
  } catch {}
  await new Promise((r) => setTimeout(r, 100));
}
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const failures = [];
page.on("pageerror", (e) => failures.push(e.message));
const date = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
let sites = [],
  ideas = [],
  weeks = [];
let launchChecks = [],
  tasks = [],
  goals = [],
  reviews = [];
const statuses = () =>
  sites.flatMap((s) =>
    ["gsc", "ga4", "bing", "adsense"].map((source) => ({
      site_id: s.id,
      source,
      enabled: source === "adsense" ? !!s.adsense_enabled : false,
      last_attempt_at: null,
      last_success_at: null,
      last_status: null,
      last_duration_ms: null,
      last_rows_fetched: 0,
      last_rows_written: 0,
      consecutive_failures: 0,
      last_error_code: null,
      last_error_message: null,
      next_run_at: null,
      stale_after_hours: 36,
      updated_at: new Date().toISOString(),
    })),
  );
await page.route("https://fixture.supabase.test/**", async (route) => {
  const req = route.request(),
    url = new URL(req.url());
  let data = [];
  if (req.method() === "OPTIONS")
    return route.fulfill({
      status: 200,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "*",
      },
    });
  if (url.pathname.includes("/functions/v1/")) {
    const b = req.postDataJSON(),
      now = new Date().toISOString();
    if (url.pathname.endsWith("manage-sites")) {
      if (b.action === "delete") sites = sites.filter((s) => s.id !== b.id);
      else if (b.action === "create")
        sites.push({
          ...b.site,
          id: crypto.randomUUID(),
          created_at: now,
          updated_at: now,
        });
      else
        sites = sites.map((s) =>
          s.id === b.id ? { ...s, ...b.site, updated_at: now } : s,
        );
      data = {
        ok: true,
        site: sites.find((s) => s.id === b.id) ?? sites.at(-1),
      };
    } else if (url.pathname.endsWith("manage-factory")) {
      if (b.action === "launch.save")
        launchChecks = [
          ...launchChecks.filter(
            (c) =>
              c.site_id !== b.values.site_id ||
              c.item_key !== b.values.item_key,
          ),
          {
            ...b.values,
            verified_at: b.values.status === "ready" ? now : null,
            updated_at: now,
          },
        ];
      if (b.action === "task.save") {
        const value = {
          ...b.values,
          id: b.values.id ?? crypto.randomUUID(),
          updated_at: now,
        };
        tasks = [...tasks.filter((t) => t.id !== value.id), value];
      }
      if (b.action === "goal.save")
        goals = [
          ...goals.filter((g) => g.site_id !== b.values.site_id),
          { ...b.values, updated_at: now },
        ];
      if (b.action === "review.save")
        reviews.push({
          ...b.values,
          id: crypto.randomUUID(),
          period_start: date,
          period_end: date,
          metric: "sessions",
          target: goals[0].target,
          observed: null,
          coverage_days: 0,
          suggestion: "INSUFFICIENT",
          created_at: now,
        });
      if (b.action === "idea.create")
        ideas.push({
          ...b.values,
          id: crypto.randomUUID(),
          opportunity_score: 0,
          created_at: now,
          updated_at: now,
        });
      if (b.action === "idea.update")
        ideas = ideas.map((i) =>
          i.id === b.id ? { ...i, ...b.values, updated_at: now } : i,
        );
      if (b.action === "idea.delete")
        ideas = ideas.filter((i) => i.id !== b.id);
      if (b.action === "week.save")
        weeks = [
          ...weeks.filter((w) => w.week_start !== b.values.week_start),
          { ...b.values, updated_at: now },
        ];
      data = { ok: true, result: b.values };
    }
  } else if (url.pathname.includes("/rest/v1/")) {
    const table = url.pathname.split("/").at(-1);
    data =
      {
        sites,
        ideas,
        factory_weeks: weeks,
        product_launch_checks: launchChecks,
        product_tasks: tasks,
        product_review_goals: goals,
        product_reviews: reviews,
        integration_status: statuses(),
        adsense_daily_metrics: sites
          .filter((s) => s.adsense_enabled)
          .map((s) => ({
            product_id: s.id,
            metric_date: date,
            currency_code: "USD",
            estimated_earnings: 2,
            page_views: 100,
            impressions: 80,
            ad_requests: 200,
            matched_ad_requests: 100,
            clicks: 2,
            ctr: 0.02,
            rpm: 20,
            coverage: 0.5,
            mapping_key: s.adsense_mapping_key,
            synced_at: new Date().toISOString(),
          })),
      }[table] ?? [];
    const id = url.searchParams.get("id");
    if (id) data = data.filter((r) => r.id === id.slice(3));
    if (req.headers().accept?.includes("vnd.pgrst.object"))
      data = data[0] ?? null;
  }
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify(data),
  });
});
await page.goto("http://127.0.0.1:5187/tests/browser/index.html");
await page.getByRole("link", { name: "제품", exact: true }).click();
await page.getByRole("button", { name: "Register P001" }).click();
await mkdir("test-results", { recursive: true });
await page.getByRole("navigation", { name: "Registration steps" }).waitFor();
assert.equal(
  await page.getByLabel("Active", { exact: true }).isChecked(),
  false,
);
await page.screenshot({ path: "test-results/F01-desktop.png", fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
assert.equal(
  await page
    .getByRole("dialog")
    .evaluate((el) => el.scrollWidth <= el.clientWidth),
  true,
);
await page.screenshot({ path: "test-results/F01-mobile.png", fullPage: true });
await page.setViewportSize({ width: 1440, height: 1000 });
await page
  .getByRole("button", { name: "Add product", exact: true })
  .last()
  .click();
await page.getByText("IPOScore", { exact: true }).first().waitFor();
assert.equal(sites[0].product_code, "P001");
assert.equal(sites[0].status, "LIVE");
await page.getByRole("link").filter({ hasText: "IPOScore" }).first().click();
await page.getByRole("button", { name: "제품 편집", exact: true }).click();
await page.getByLabel("AdSense verified site domain").fill("iposcore.kr");
await page.getByLabel("Enable AdSense").check();
await page.getByRole("button", { name: "Save changes" }).click();
await page.getByRole("button", { name: "수익", exact: true }).click();
await page.getByText("$2.00", { exact: true }).first().waitFor();
await page.getByRole("link", { name: "아이디어", exact: true }).click();
await page.getByRole("button", { name: "Add idea", exact: true }).click();
await page.getByLabel("Title", { exact: true }).fill("Fixture utility");
await page
  .getByLabel("Problem / unmet need", { exact: true })
  .fill("A repeat task needs a simple answer");
await page.getByRole("button", { name: "Save idea" }).click();
await page.getByRole("button", { name: "Fixture utility" }).click();
await page.getByLabel("Title", { exact: true }).fill("Updated utility");
await page.getByRole("button", { name: "Save idea" }).click();
await page.getByRole("button", { name: "Updated utility" }).waitFor();
assert.equal(ideas[0].title, "Updated utility");
await page.getByRole("link", { name: "주간 관리", exact: true }).click();
await page
  .getByLabel("이번 주 제품", { exact: true })
  .selectOption(sites[0].id);
await page.getByLabel("실험 가설").fill("Weekly traffic increases");
await page.getByRole("button", { name: "이번 주 기록 저장" }).click();
await page
  .getByText("Weekly traffic increases", { exact: true })
  .last()
  .waitFor();
assert.equal(weeks.length, 1);
await page.getByLabel("IPOScore 사업 상태").selectOption("SCALE");
await page.waitForTimeout(200);
assert.equal(sites[0].status, "SCALE");
await mkdir("test-results", { recursive: true });
await page.screenshot({
  path: "test-results/factory-desktop.png",
  fullPage: true,
});
await page.getByRole("link", { name: "전체 현황", exact: true }).click();
await page.getByText("Build a portfolio that compounds.").waitFor();
await page.getByText("Not Connected", { exact: true }).first().waitFor();
await page.screenshot({
  path: "test-results/overview-desktop.png",
  fullPage: true,
});
await page.getByRole("link", { name: "제품", exact: true }).click();
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({
  path: "test-results/products-mobile.png",
  fullPage: true,
});
await page.getByRole("link", { name: "아이디어", exact: true }).click();
await page.getByRole("button", { name: "Delete", exact: true }).click();
await page.getByRole("button", { name: "Confirm delete" }).click();
await page.getByText("No ideas in this market yet.").waitFor();
assert.equal(ideas.length, 0);
await page.setViewportSize({ width: 1440, height: 1000 });
await page.getByRole("link", { name: "제품", exact: true }).click();
await page.getByRole("link").filter({ hasText: "IPOScore" }).first().click();
await page.getByRole("button", { name: "출시 준비", exact: true }).click();
await page.getByLabel("핵심 기능 확인 내용").fill("Verified synthetic fixture");
await page.getByLabel("핵심 기능 확인 상태").selectOption("ready");
await page.getByRole("button", { name: "핵심 기능 저장", exact: true }).click();
await page.getByText(/확인 시각/).waitFor();
assert.equal(launchChecks[0].status, "ready");
await page.getByRole("button", { name: "작업 현황", exact: true }).click();
await page.getByText("새 개선 작업 등록", { exact: true }).click();
await page.getByLabel("새 작업 제목").fill("Fix fixture measurement");
await page.getByLabel("새 작업 상태").selectOption("doing");
await page.getByLabel("우선순위").first().selectOption("high");
await page.getByLabel("연결할 주의 월요일").first().fill("2026-11-11");
await page.getByRole("button", { name: "개선 작업 추가", exact: true }).click();
await page
  .locator("summary")
  .filter({ hasText: "Fix fixture measurement" })
  .waitFor();
assert.equal(tasks.length, 1);
assert.equal(tasks[0].status, "doing");
assert.equal(tasks[0].priority, "high");
assert.equal(tasks[0].week_start, "2026-11-09");
await page.getByRole("button", { name: "평가", exact: true }).click();
await page.getByLabel("목표 합계", { exact: true }).fill("250");
await page.getByRole("button", { name: "평가 목표 저장", exact: true }).click();
await page
  .getByRole("heading", { name: "평가 미리보기", exact: true })
  .waitFor();
await page.getByText("자료 부족", { exact: true }).waitFor();
await page
  .getByLabel("평가 판단 근거")
  .fill("Defer until real data is available");
await page.getByRole("button", { name: "평가 기록 저장", exact: true }).click();
await page.getByText(/운영자 판단:/).waitFor();
assert.equal(reviews[0].observed, null);
assert.equal(reviews[0].decision, "DEFER");
assert.equal(sites[0].status, "SCALE");
await page.screenshot({
  path: "test-results/review-desktop.png",
  fullPage: true,
});
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: "작업 현황", exact: true }).click();
await page
  .locator("summary")
  .filter({ hasText: "Fix fixture measurement" })
  .click();
assert.equal(
  await page.getByLabel(`작업 제목 ${tasks[0].id}`).inputValue(),
  "Fix fixture measurement",
);
await page.screenshot({ path: "test-results/work-mobile.png", fullPage: true });
assert.equal(
  await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  ),
  true,
  "Product operations should fit the mobile viewport",
);
assert.equal(
  await page
    .locator('nav[aria-label="제품 상세 탭"] button')
    .evaluateAll((buttons) =>
      buttons.every((b) => b.scrollHeight <= b.clientHeight),
    ),
  true,
  "Korean tab labels must remain readable without vertical text overflow",
);
await page.setViewportSize({ width: 1440, height: 1000 });
await page.getByRole("link", { name: "주간 관리", exact: true }).click();
await page
  .getByRole("button", { name: "주간 보고서 열기", exact: true })
  .click();
await page
  .getByRole("button", { name: "주간 보고서 내려받기", exact: true })
  .waitFor();
const downloadPromise = page.waitForEvent("download");
await page
  .getByRole("button", { name: "주간 보고서 내려받기", exact: true })
  .click();
const download = await downloadPromise;
assert.match(download.suggestedFilename(), /주간보고서\.txt$/);
await page.screenshot({
  path: "test-results/weekly-report-desktop.png",
  fullPage: true,
});
assert.deepEqual(failures, []);
console.log(
  "PASS: Product/Ideas/Week regression; persisted launch checklist, improvement task, goal and deferred evaluation; weekly report; desktop/mobile renders. Fixture backend; no live provider calls.",
);
await browser.close();

server.kill();
