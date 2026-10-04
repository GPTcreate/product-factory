import { describe, it, expect, vi, afterEach } from "vitest";
import { parseSiteInput } from "../../supabase/functions/_shared/site-input";
import {
  parseIdea,
  parseWeek,
} from "../../supabase/functions/_shared/factory-input";
import {
  EMPTY_SCORES,
  SCORE_WEIGHTS,
  opportunityScore,
} from "../../supabase/functions/_shared/product";
import {
  adSenseReportUrl,
  normalizeAdSense,
  ADSENSE_DIMENSION,
  ADSENSE_METRICS,
  type AdSenseReport,
} from "../../supabase/functions/_shared/adsense-report";
import { adsenseAdapter } from "../../supabase/functions/_shared/adsense";
import { clearGoogleTokenCache } from "../../supabase/functions/_shared/google-auth";
import type { SyncContext } from "../../supabase/functions/_shared/sync-run";
import { revenueSummary, metricState, monday } from "../features/factory/model";
const site = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "IPOScore",
  domain: "iposcore.kr",
  website_url: "https://iposcore.kr",
  product_code: "P001",
  status: "LIVE",
  market: "Korea",
  level: 1,
  adsense_enabled: true,
  adsense_mapping_key: "iposcore.kr",
  gsc_property: null,
  ga4_property_id: null,
  bing_site_url: null,
};
const idea = {
  title: "Idea",
  problem: "Problem",
  target_user: "",
  market: "Korea",
  primary_language: "ko",
  acquisition_channel: "",
  repeat_usage_potential: "",
  ad_potential: "",
  premium_potential: "",
  competition: "",
  build_difficulty: "",
  maintenance_risk: "",
  level_candidate: 1,
  scores: { ...EMPTY_SCORES },
  evidence: "",
  notes: "",
  status: "IDEA",
};
const report = (): AdSenseReport => ({
  totalMatchedRows: "1",
  headers: ["DATE", ADSENSE_DIMENSION, ...ADSENSE_METRICS].map((name) => ({
    name,
    currencyCode:
      name === "ESTIMATED_EARNINGS" || name === "PAGE_VIEWS_RPM"
        ? "USD"
        : undefined,
  })),
  rows: [
    {
      cells: [
        "2026-10-01",
        "iposcore.kr",
        "2",
        "80",
        "100",
        "200",
        "100",
        "2",
        "0.02",
        "20",
        "0.5",
      ].map((value) => ({ value })),
    },
  ],
});
const normalize = (r: AdSenseReport) =>
  normalizeAdSense(
    r,
    site.id,
    "iposcore.kr",
    "USD",
    "2026-10-02T00:00:00Z",
    "2026-10-01",
    "2026-10-02",
  );
afterEach(() => {
  vi.unstubAllGlobals();
  clearGoogleTokenCache();
});
describe("Product Factory contracts", () => {
  it("validates P001 and preserves original site fields", () => {
    const parsed = parseSiteInput(site);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.product_code).toBe("P001");
  });
  it.each([
    { level: 4 },
    { status: "UNKNOWN" },
    { product_code: "001" },
    { launch_date: "2026-02-30" },
    { github_repo: "javascript:alert(1)" },
    { adsense_mapping_key: "iposcore.kr,other.kr" },
    { adsense_mapping_key: "" },
  ])("rejects unsafe product fields %o", (change) =>
    expect(parseSiteInput({ ...site, ...change }).ok).toBe(false),
  );
  it("scores all eight criteria and ignores caller-supplied score", () => {
    expect(opportunityScore({ ...EMPTY_SCORES, utility: 5, organic: 5 })).toBe(
      40,
    );
    expect(
      opportunityScore(
        Object.fromEntries(
          Object.keys(SCORE_WEIGHTS).map((k) => [k, 5]),
        ) as typeof EMPTY_SCORES,
      ),
    ).toBe(100);
    const parsed = parseIdea({ ...idea, opportunity_score: 100 });
    expect(parsed.ok && parsed.value.opportunity_score).toBe(0);
  });
  it("rejects invalid idea scores and missing problems", () => {
    expect(
      parseIdea({ ...idea, scores: { ...EMPTY_SCORES, utility: 6 } }).ok,
    ).toBe(false);
    expect(parseIdea({ ...idea, problem: "" }).ok).toBe(false);
  });
  it("uses a Monday in Korea and rejects non-Monday records", () => {
    expect(monday("2026-10-04")).toBe("2026-09-28");
    expect(
      parseWeek({
        week_start: "2026-10-04",
        product_id: null,
        notes: "",
        hypothesis: "",
        success_metric: "",
        result: "",
        decision: "",
      }).ok,
    ).toBe(false);
  });
});
describe("AdSense attribution and reporting", () => {
  it("uses exact verified-domain filtering, explicit dates and currency", () => {
    const url = adSenseReportUrl(
      "accounts/pub-123",
      "iposcore.kr",
      "2026-10-01",
      "2026-10-02",
      "USD",
    );
    expect(url.searchParams.get("filters")).toBe(
      "OWNED_SITE_DOMAIN_NAME==iposcore.kr",
    );
    expect(url.searchParams.get("startDate.month")).toBe("10");
    expect(url.searchParams.getAll("metrics")).toEqual([...ADSENSE_METRICS]);
  });
  it("maps by header name even with reordered columns", () => {
    const r = report();
    r.headers!.reverse();
    r.rows![0].cells.reverse();
    expect(normalize(r)[0]).toMatchObject({
      estimated_earnings: 2,
      rpm: 20,
      ctr: 0.02,
      coverage: 0.5,
      product_id: site.id,
    });
  });
  it("preserves actual zero earnings", () => {
    const r = report();
    r.rows![0].cells[2].value = "0";
    expect(normalize(r)[0].estimated_earnings).toBe(0);
  });
  it.each([
    "mapping",
    "currency",
    "truncated",
    "missing",
    "invalid",
    "duplicate",
  ])("rejects %s before storage", (condition) => {
    const r = report();
    if (condition === "mapping") r.rows![0].cells[1].value = "other.kr";
    if (condition === "currency") r.headers![2].currencyCode = "KRW";
    if (condition === "truncated") r.totalMatchedRows = "2";
    if (condition === "missing") r.headers![2].name = "WRONG";
    if (condition === "invalid") r.rows![0].cells[3].value = "NaN";
    if (condition === "duplicate") {
      r.rows!.push(r.rows![0]);
      r.totalMatchedRows = "2";
    }
    expect(() => normalize(r)).toThrow();
  });
  it("does not fabricate empty report rows", () =>
    expect(normalize({ totalMatchedRows: "0", rows: [] })).toEqual([]));
  it("recomputes weighted ratios and prevents currency mixing", () => {
    const rows = normalize(report());
    rows.push({
      ...rows[0],
      metric_date: "2026-10-02",
      estimated_earnings: 8,
      page_views: 900,
      clicks: 8,
    });
    expect(revenueSummary(rows)).toMatchObject({
      earnings: 10,
      rpm: 10,
      ctr: 0.01,
    });
    expect(
      revenueSummary([...rows, { ...rows[0], currency_code: "KRW" }]).earnings,
    ).toBeNull();
  });
  it("distinguishes not connected, absent data and zero", () => {
    expect(metricState(false, false, "0")).toBe("Not Connected");
    expect(metricState(true, false, "0")).toBe("No Data");
    expect(metricState(true, true, "0")).toBe("0");
  });
  it("fixture E2E: OAuth → report → idempotent upsert twice", async () => {
    vi.stubGlobal("Deno", {
      env: {
        get: (k: string) =>
          ({
            GOOGLE_CLIENT_ID: "fixture-client",
            GOOGLE_CLIENT_SECRET: "fixture-secret",
            GOOGLE_REFRESH_TOKEN: "fixture-refresh",
            ADSENSE_ACCOUNT: "accounts/pub-123",
            ADSENSE_CURRENCY_CODE: "USD",
          })[k],
      },
    });
    const fetcher = vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.includes("oauth2")
              ? { access_token: "fixture-token", expires_in: 3600 }
              : report(),
          ),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetcher);
    const stored = new Map();
    const upsert = vi.fn(
      async (
        rows: ReturnType<typeof normalize>,
        options: { onConflict: string },
      ) => {
        expect(options.onConflict).toBe("product_id,metric_date");
        rows.forEach((r) => stored.set(r.product_id + ":" + r.metric_date, r));
        return { error: null };
      },
    );
    const context = {
      admin: {
        from: (table: string) => {
          expect(table).toBe("adsense_daily_metrics");
          return { upsert };
        },
      },
      site,
      source: "adsense",
      rangeStart: "2026-10-01",
      rangeEnd: "2026-10-02",
    } as unknown as SyncContext;
    expect((await adsenseAdapter(context)).rowsWritten).toBe(1);
    await adsenseAdapter(context);
    expect(stored.size).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
