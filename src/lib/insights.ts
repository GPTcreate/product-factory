import { computeHealth } from "@/lib/health";
import { SOURCE_LABEL } from "@/lib/sources";
import {
  percentageChange,
  splitPeriods,
  sumBy,
  weightedAveragePosition,
  weightedCtr,
} from "@/lib/metrics";
import type {
  AnalyticsDaily,
  IntegrationStatus,
  SearchDaily,
  Site,
} from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface Delta {
  current: number;
  previous: number;
  pct: number | null;
}

export type InsightSeverity = "critical" | "warning" | "positive" | "info";

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
  action?: string;
  siteId?: string;
}

export interface Anomaly {
  date: string;
  value: number;
  mean: number;
  z: number;
}

export interface SiteRow {
  siteId: string;
  siteName: string;
  domain: string;
  anomaly: Anomaly | null;
  sessions: Delta;
  users: Delta;
  pageViews: Delta;
  engagedSessions: Delta;
  clicks: Delta;
  impressions: Delta;
  ctr: number | null;
  ctrPrev: number | null;
  position: number | null;
  engagementRate: number | null;
  pagesPerSession: number | null;
  bingClicks: number;
  googleClicks: number;
  sparkline: number[];
}

export interface CoverageRow {
  siteId: string;
  siteName: string;
  source: "gsc" | "ga4" | "bing" | "adsense";
  lastDataDate: string | null;
  staleDays: number | null;
  hasGap: boolean;
}

export interface InsightsResult {
  days: number;
  health: {
    activeSites: number;
    enabledIntegrations: number;
    healthy: number;
    warning: number;
    critical: number;
    pending: number;
    attention: number;
  };
  kpis: {
    clicks: Delta;
    impressions: Delta;
    users: Delta;
    sessions: Delta;
  };
  engineSplit: { google: number; bing: number };
  sites: SiteRow[];
  movers: { gainers: SiteRow[]; decliners: SiteRow[] };
  coverage: CoverageRow[];
  insights: Insight[];
}

interface ComputeInput {
  sites: Site[];
  statuses: IntegrationStatus[];
  analytics: AnalyticsDaily[];
  search: SearchDaily[];
  days: number;
  now?: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function delta(current: number, previous: number): Delta {
  return { current, previous, pct: percentageChange(current, previous) };
}

function groupBy<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k) ?? [];
    list.push(row);
    map.set(k, list);
  }
  return map;
}

const SEVERITY_RANK: Record<InsightSeverity, number> = {
  critical: 0,
  warning: 1,
  positive: 2,
  info: 3,
};

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------
export function computeInsights(input: ComputeInput): InsightsResult {
  const now = input.now ?? new Date();
  const { days } = input;
  const activeSites = input.sites.filter((s) => s.is_active);

  const analyticsBySite = groupBy(input.analytics, (r) => r.site_id);
  const searchBySite = groupBy(input.search, (r) => r.site_id);
  const statusBySite = groupBy(input.statuses, (r) => r.site_id);

  const siteRows: SiteRow[] = activeSites.map((site) => {
    const analytics = analyticsBySite.get(site.id) ?? [];
    const search = searchBySite.get(site.id) ?? [];
    const google = search.filter((r) => r.engine === "google");
    const bing = search.filter((r) => r.engine === "bing");

    const a = splitPeriods(analytics, days);
    const g = splitPeriods(google, days);
    const b = splitPeriods(bing, days);

    const sessionsCur = sumBy(a.current, (r) => r.sessions);
    const sessionsPrev = sumBy(a.previous, (r) => r.sessions);
    const usersCur = sumBy(a.current, (r) => r.active_users);
    const usersPrev = sumBy(a.previous, (r) => r.active_users);
    const pvCur = sumBy(a.current, (r) => r.screen_page_views);
    const pvPrev = sumBy(a.previous, (r) => r.screen_page_views);
    const engCur = sumBy(a.current, (r) => r.engaged_sessions);
    const engPrev = sumBy(a.previous, (r) => r.engaged_sessions);

    const gClicksCur = sumBy(g.current, (r) => r.clicks);
    const gClicksPrev = sumBy(g.previous, (r) => r.clicks);
    const gImprCur = sumBy(g.current, (r) => r.impressions);
    const gImprPrev = sumBy(g.previous, (r) => r.impressions);
    const bClicksCur = sumBy(b.current, (r) => r.clicks);
    const bImprCur = sumBy(b.current, (r) => r.impressions);

    const clicksCur = gClicksCur + bClicksCur;
    const clicksPrev = gClicksPrev + sumBy(b.previous, (r) => r.clicks);
    const imprCur = gImprCur + bImprCur;
    const imprPrev = gImprPrev + sumBy(b.previous, (r) => r.impressions);

    // sparkline = daily sessions across the current window (fallback to clicks)
    const sparkSource =
      a.current.length > 0
        ? a.current.map((r) => r.sessions)
        : g.current.map((r) => r.clicks);

    return {
      siteId: site.id,
      siteName: site.name,
      domain: site.domain,
      anomaly: detectAnomaly(a.current),
      sessions: delta(sessionsCur, sessionsPrev),
      users: delta(usersCur, usersPrev),
      pageViews: delta(pvCur, pvPrev),
      engagedSessions: delta(engCur, engPrev),
      clicks: delta(clicksCur, clicksPrev),
      impressions: delta(imprCur, imprPrev),
      ctr: weightedCtr(gClicksCur, gImprCur),
      ctrPrev: weightedCtr(gClicksPrev, gImprPrev),
      position: weightedAveragePosition(g.current),
      engagementRate: sessionsCur > 0 ? engCur / sessionsCur : null,
      pagesPerSession: sessionsCur > 0 ? pvCur / sessionsCur : null,
      bingClicks: bClicksCur,
      googleClicks: gClicksCur,
      sparkline: sparkSource,
    };
  });

  // Portfolio KPIs
  const kpis = {
    clicks: delta(
      sumBy(siteRows, (s) => s.clicks.current),
      sumBy(siteRows, (s) => s.clicks.previous),
    ),
    impressions: delta(
      sumBy(siteRows, (s) => s.impressions.current),
      sumBy(siteRows, (s) => s.impressions.previous),
    ),
    users: delta(
      sumBy(siteRows, (s) => s.users.current),
      sumBy(siteRows, (s) => s.users.previous),
    ),
    sessions: delta(
      sumBy(siteRows, (s) => s.sessions.current),
      sumBy(siteRows, (s) => s.sessions.previous),
    ),
  };

  const engineSplit = {
    google: sumBy(siteRows, (s) => s.googleClicks),
    bing: sumBy(siteRows, (s) => s.bingClicks),
  };

  // Top movers by clicks % change (need meaningful volume)
  const moverPool = siteRows.filter(
    (s) => s.clicks.pct !== null && s.clicks.current + s.clicks.previous >= 20,
  );
  const byPct = [...moverPool].sort(
    (x, y) => (y.clicks.pct ?? 0) - (x.clicks.pct ?? 0),
  );
  const gainers = byPct.filter((s) => (s.clicks.pct ?? 0) > 0).slice(0, 3);
  const decliners = byPct
    .filter((s) => (s.clicks.pct ?? 0) < 0)
    .slice(-3)
    .reverse();

  // Health roll-up
  const health = rollUpHealth(activeSites, statusBySite, now);

  // Coverage
  const coverage = computeCoverage(
    activeSites,
    statusBySite,
    analyticsBySite,
    searchBySite,
    now,
  );

  const insights = buildInsights({
    siteRows,
    gainers,
    decliners,
    coverage,
    statusBySite,
    activeSites,
    engineSplit,
    now,
  });

  return {
    days,
    health,
    kpis,
    engineSplit,
    sites: siteRows,
    movers: { gainers, decliners },
    coverage,
    insights,
  };
}

function rollUpHealth(
  activeSites: Site[],
  statusBySite: Map<string, IntegrationStatus[]>,
  now: Date,
) {
  let enabled = 0;
  let healthy = 0;
  let warning = 0;
  let critical = 0;
  let pending = 0;
  for (const site of activeSites) {
    for (const status of statusBySite.get(site.id) ?? []) {
      if (status.enabled) enabled += 1;
      const level = computeHealth(status, now).level;
      if (level === "healthy") healthy += 1;
      else if (level === "warning") warning += 1;
      else if (level === "critical") critical += 1;
      else if (level === "pending") pending += 1;
    }
  }
  return {
    activeSites: activeSites.length,
    enabledIntegrations: enabled,
    healthy,
    warning,
    critical,
    pending,
    attention: warning + critical,
  };
}

function lastDate(rows: { metric_date: string }[]): string | null {
  let max: string | null = null;
  for (const r of rows) if (!max || r.metric_date > max) max = r.metric_date;
  return max;
}

function daysBetween(fromIso: string, now: Date): number {
  const then = new Date(`${fromIso}T00:00:00Z`).getTime();
  return Math.floor((now.getTime() - then) / 86_400_000);
}

function computeCoverage(
  activeSites: Site[],
  statusBySite: Map<string, IntegrationStatus[]>,
  analyticsBySite: Map<string, AnalyticsDaily[]>,
  searchBySite: Map<string, SearchDaily[]>,
  now: Date,
): CoverageRow[] {
  const rows: CoverageRow[] = [];
  for (const site of activeSites) {
    const statuses = statusBySite.get(site.id) ?? [];
    const search = searchBySite.get(site.id) ?? [];
    for (const status of statuses) {
      if (!status.enabled) continue;
      let last: string | null = null;
      if (status.source === "ga4") {
        last = lastDate(analyticsBySite.get(site.id) ?? []);
      } else {
        const engine = status.source === "gsc" ? "google" : "bing";
        last = lastDate(search.filter((r) => r.engine === engine));
      }
      // Providers lag ~2 days; flag as a gap only beyond 3 days.
      const staleDays = last ? daysBetween(last, now) : null;
      rows.push({
        siteId: site.id,
        siteName: site.name,
        source: status.source,
        lastDataDate: last,
        staleDays,
        hasGap: last == null || (staleDays ?? 0) > 3,
      });
    }
  }
  return rows;
}

interface BuildInput {
  siteRows: SiteRow[];
  gainers: SiteRow[];
  decliners: SiteRow[];
  coverage: CoverageRow[];
  statusBySite: Map<string, IntegrationStatus[]>;
  activeSites: Site[];
  engineSplit: { google: number; bing: number };
  now: Date;
}

function buildInsights(input: BuildInput): Insight[] {
  const out: Insight[] = [];

  // Failing integrations (critical/warning)
  for (const site of input.activeSites) {
    for (const status of input.statusBySite.get(site.id) ?? []) {
      const health = computeHealth(status, input.now);
      if (health.level === "critical") {
        out.push({
          id: `health-${site.id}-${status.source}`,
          severity: "critical",
          title: `${site.name}: ${SOURCE_LABEL[status.source]} ${health.title}`,
          detail: health.reason,
          action: "수집 이력에서 오류·인증 상태를 확인하세요.",
          siteId: site.id,
        });
      }
    }
  }

  // Big decliners
  for (const s of input.decliners) {
    const pct = s.clicks.pct ?? 0;
    if (pct <= -20) {
      out.push({
        id: `decline-${s.siteId}`,
        severity: "warning",
        title: `${s.siteName}: 검색 클릭 ${Math.abs(Math.round(pct))}% 감소`,
        detail: `직전 기간보다 검색 클릭이 ${s.clicks.previous.toLocaleString()}회에서 ${s.clicks.current.toLocaleString()}회로 줄었습니다.`,
        action: "검색 순위 하락, 색인 제외, 계절적 변화를 확인하세요.",
        siteId: s.siteId,
      });
    }
  }

  // Big gainers
  for (const s of input.gainers) {
    const pct = s.clicks.pct ?? 0;
    if (pct >= 25) {
      out.push({
        id: `gain-${s.siteId}`,
        severity: "positive",
        title: `${s.siteName}: 검색 클릭 ${Math.round(pct)}% 증가`,
        detail: `검색 클릭이 ${s.clicks.previous.toLocaleString()}회에서 ${s.clicks.current.toLocaleString()}회로 늘었습니다.`,
        action: "성과가 좋은 페이지·검색어를 확인하고 개선을 이어가세요.",
        siteId: s.siteId,
      });
    }
  }

  // CTR opportunities vs portfolio benchmark
  const benchCtr = portfolioCtr(input.siteRows);
  if (benchCtr != null) {
    for (const s of input.siteRows) {
      if (
        s.ctr != null &&
        s.impressions.current >= 1000 &&
        s.ctr < benchCtr * 0.6
      ) {
        out.push({
          id: `ctr-${s.siteId}`,
          severity: "info",
          title: `${s.siteName}: 낮은 클릭률 (${(s.ctr * 100).toFixed(1)}%)`,
          detail: `${s.impressions.current.toLocaleString()}회 노출됐지만 클릭률은 전체 제품 평균 ${(benchCtr * 100).toFixed(1)}%보다 크게 낮습니다.`,
          action: "검색 결과의 제목·설명을 개선해 클릭을 유도하세요.",
          siteId: s.siteId,
        });
      }
    }
  }

  // Ranking opportunities
  for (const s of input.siteRows) {
    if (
      s.position != null &&
      s.position > 15 &&
      s.impressions.current >= 1000
    ) {
      out.push({
        id: `pos-${s.siteId}`,
        severity: "info",
        title: `${s.siteName}: 평균 검색 순위 ${s.position.toFixed(1)}위`,
        detail: `${s.impressions.current.toLocaleString()}회 노출되지만 검색 결과 2페이지 이후에 위치합니다.`,
        action: "주요 페이지를 개선해 검색 결과 첫 페이지 진입을 검토하세요.",
        siteId: s.siteId,
      });
    }
  }

  // Anomalous days
  for (const s of input.siteRows) {
    if (s.anomaly) {
      const dir = s.anomaly.z > 0 ? "spike" : "drop";
      out.push({
        id: `anomaly-${s.siteId}`,
        severity: s.anomaly.z > 0 ? "info" : "warning",
        title: `${s.siteName}: ${s.anomaly.date} 방문 ${dir === "spike" ? "급증" : "급감"}`,
        detail: `해당 날짜의 세션 수는 ${Math.round(s.anomaly.value).toLocaleString()}회이며 기간 평균은 약 ${Math.round(s.anomaly.mean).toLocaleString()}회입니다.`,
        action:
          s.anomaly.z > 0
            ? "유입 경로를 살펴보고 반복할 가치가 있는 소개·링크·캠페인을 확인하세요."
            : "해당 날짜의 장애, 측정 누락, 검색 순위 하락을 확인하세요.",
        siteId: s.siteId,
      });
    }
  }

  // Coverage gaps
  for (const c of input.coverage) {
    if (c.hasGap) {
      out.push({
        id: `cov-${c.siteId}-${c.source}`,
        severity: "warning",
        title: `${c.siteName}: ${SOURCE_LABEL[c.source]} 최근 자료 확인 필요`,
        detail: c.lastDataDate
          ? `${c.lastDataDate} 이후 ${c.staleDays}일 동안 새 ${SOURCE_LABEL[c.source]} 자료가 없습니다.`
          : `아직 저장된 ${SOURCE_LABEL[c.source]} 자료가 없습니다.`,
        action: "수동 수집을 실행하고 속성 설정을 확인하세요.",
        siteId: c.siteId,
      });
    }
  }

  // Dedupe by id, sort by severity then title
  const seen = new Set<string>();
  const deduped = out.filter((i) =>
    seen.has(i.id) ? false : (seen.add(i.id), true),
  );
  deduped.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      a.title.localeCompare(b.title),
  );
  return deduped.slice(0, 14);
}

/** Flag the single most extreme day in a session series (|z| > 3). */
function detectAnomaly(rows: AnalyticsDaily[]): Anomaly | null {
  if (rows.length < 8) return null;
  const vals = rows.map((r) => r.sessions);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
  const std = Math.sqrt(variance);
  if (std === 0) return null;

  let best: Anomaly | null = null;
  for (const r of rows) {
    const z = (r.sessions - mean) / std;
    if (Math.abs(z) > (best ? Math.abs(best.z) : 3)) {
      best = { date: r.metric_date, value: r.sessions, mean, z };
    }
  }
  return best;
}

function portfolioCtr(rows: SiteRow[]): number | null {
  const clicks = sumBy(rows, (s) => s.googleClicks);
  const impr = sumBy(rows, (s) => s.impressions.current);
  return impr > 0 ? clicks / impr : null;
}
