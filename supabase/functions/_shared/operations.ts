import { isUuid, type ParseResult } from "./validate.ts";
import { validDate } from "./factory-input.ts";

export const LAUNCH_ITEMS = [
  "core_flow",
  "mobile",
  "https",
  "seo",
  "sitemap",
  "analytics",
  "core_event",
  "search",
  "privacy",
  "terms",
  "contact",
  "deployment",
  "manual_sync",
  "scheduled_sync",
] as const;
export type LaunchKey = (typeof LAUNCH_ITEMS)[number];
export interface LaunchCheck {
  site_id: string;
  item_key: LaunchKey;
  status: "pending" | "ready" | "waiting" | "not_applicable";
  evidence_url: string;
  notes: string;
  verified_at: string | null;
  updated_at: string;
}
export interface ProductTask {
  id: string;
  site_id: string;
  title: string;
  status: "todo" | "doing" | "done" | "blocked";
  priority: "high" | "normal" | "low";
  owner: string;
  due_date: string | null;
  week_start: string | null;
  evidence_url: string;
  notes: string;
  updated_at: string;
}
export const REVIEW_METRICS = [
  "sessions",
  "core_action",
  "google_clicks",
  "revenue",
] as const;
export interface ReviewGoal {
  site_id: string;
  metric: (typeof REVIEW_METRICS)[number];
  target: number;
  window_days: number;
  minimum_days: number;
  updated_at: string;
}
export interface ReviewRecord {
  id: string;
  site_id: string;
  period_start: string;
  period_end: string;
  metric: ReviewGoal["metric"];
  target: number;
  observed: number | null;
  coverage_days: number;
  suggestion: string;
  decision: "HOLD" | "IMPROVE" | "SCALE" | "V2" | "DEFER";
  notes: string;
  created_at: string;
}

export function safeEvidence(value: unknown): boolean {
  if (value === "") return true;
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const u = new URL(value);
    return (
      ["http:", "https:"].includes(u.protocol) &&
      !u.username &&
      !u.password &&
      ![...u.searchParams.keys()].some((k) =>
        /token|secret|api.?key|password|authorization/i.test(k),
      )
    );
  } catch {
    return false;
  }
}
export function parseOperations(
  action: string,
  input: unknown,
): ParseResult<Record<string, unknown>> {
  if (!input || typeof input !== "object")
    return { ok: false, error: "Values required" };
  const b = input as Record<string, unknown>;
  const fail = (error: string): ParseResult<Record<string, unknown>> => ({
    ok: false,
    error,
  });
  if (!isUuid(b.site_id)) return fail("Valid product required");
  const text = (key: string, max: number) =>
    typeof b[key] === "string" && (b[key] as string).length <= max;
  if (action === "goal.save") {
    if (
      !REVIEW_METRICS.includes(b.metric as ReviewGoal["metric"]) ||
      typeof b.target !== "number" ||
      !Number.isFinite(b.target) ||
      b.target <= 0 ||
      b.target > 1e12
    )
      return fail("Choose a metric and positive target");
    if (
      !Number.isInteger(b.window_days) ||
      Number(b.window_days) < 7 ||
      Number(b.window_days) > 90 ||
      !Number.isInteger(b.minimum_days) ||
      Number(b.minimum_days) < 1 ||
      Number(b.minimum_days) > Number(b.window_days)
    )
      return fail("Window must be 7–90 days and coverage must fit the window");
    return {
      ok: true,
      value: {
        site_id: b.site_id,
        metric: b.metric,
        target: b.target,
        window_days: b.window_days,
        minimum_days: b.minimum_days,
      },
    };
  }
  if (action === "review.save") {
    if (
      !["HOLD", "IMPROVE", "SCALE", "V2", "DEFER"].includes(
        String(b.decision),
      ) ||
      !text("notes", 5000)
    )
      return fail("Decision and review notes required");
    return {
      ok: true,
      value: {
        site_id: b.site_id,
        decision: b.decision,
        notes: (b.notes as string).trim(),
      },
    };
  }
  if (!safeEvidence(b.evidence_url) || !text("notes", 5000))
    return fail(
      "Use a public evidence URL without credentials and notes up to 5000 characters",
    );
  if (action === "launch.save") {
    if (
      !LAUNCH_ITEMS.includes(b.item_key as LaunchKey) ||
      !["pending", "ready", "waiting", "not_applicable"].includes(
        String(b.status),
      )
    )
      return fail("Invalid checklist item or status");
    if (b.status === "ready" && !b.evidence_url && !(b.notes as string).trim())
      return fail("Ready items need evidence or verification notes");
    return {
      ok: true,
      value: {
        site_id: b.site_id,
        item_key: b.item_key,
        status: b.status,
        evidence_url: b.evidence_url,
        notes: (b.notes as string).trim(),
      },
    };
  }
  if (action === "task.save") {
    if (
      !text("title", 200) ||
      !(b.title as string).trim() ||
      !text("owner", 120) ||
      !["todo", "doing", "done", "blocked"].includes(String(b.status)) ||
      !["high", "normal", "low"].includes(String(b.priority))
    )
      return fail("Invalid task title, owner, status or priority");
    if (b.id !== undefined && !isUuid(b.id)) return fail("Invalid task ID");
    if (b.due_date !== null && !validDate(b.due_date))
      return fail("Invalid due date");
    if (
      b.week_start !== null &&
      (!validDate(b.week_start) || new Date(b.week_start).getUTCDay() !== 1)
    )
      return fail("Week must start on Monday");
    if (b.status === "done" && !b.evidence_url && !(b.notes as string).trim())
      return fail("Completed tasks need evidence or completion notes");
    return {
      ok: true,
      value: {
        ...(b.id ? { id: b.id } : {}),
        site_id: b.site_id,
        title: (b.title as string).trim(),
        owner: (b.owner as string).trim(),
        status: b.status,
        priority: b.priority,
        due_date: b.due_date,
        week_start: b.week_start,
        evidence_url: b.evidence_url,
        notes: (b.notes as string).trim(),
      },
    };
  }
  return fail("Unknown operations action");
}

export interface PeriodValue {
  value: number | null;
  days: number;
  currency: string | null;
  mixed: boolean;
}
export function periodValue(
  rows: { metric_date: string; value: number; currency?: string }[],
  start: string,
  end: string,
): PeriodValue {
  const selected = rows.filter(
    (r) => r.metric_date >= start && r.metric_date <= end,
  );
  const currencies = new Set(selected.map((r) => r.currency).filter(Boolean));
  const mixed = currencies.size > 1;
  const invalid = selected.some(
    (r) => !Number.isFinite(r.value) || r.value < 0,
  );
  return {
    value:
      !selected.length || mixed || invalid
        ? null
        : selected.reduce((sum, r) => sum + r.value, 0),
    days: new Set(selected.map((r) => r.metric_date)).size,
    currency: currencies.size === 1 ? [...currencies][0]! : null,
    mixed,
  };
}
export function reviewSuggestion(
  goal: Pick<ReviewGoal, "target" | "minimum_days">,
  observed: PeriodValue,
  reliable: boolean,
): string {
  if (!reliable || observed.value === null || observed.days < goal.minimum_days)
    return "INSUFFICIENT";
  return observed.value >= goal.target
    ? "SCALE"
    : observed.value >= goal.target * 0.5
      ? "HOLD"
      : "IMPROVE";
}
export function reviewPeriod(
  days: number,
  now = new Date(),
): { start: string; end: string; previousStart: string; previousEnd: string } {
  const today = Date.parse(now.toISOString().slice(0, 10));
  const date = (offset: number) =>
    new Date(today - offset * 86400000).toISOString().slice(0, 10);
  return {
    start: date(days),
    end: date(1),
    previousStart: date(days * 2),
    previousEnd: date(days + 1),
  };
}

export function weeklyRange(week: string, now = new Date()) {
  const startMs = Date.parse(week);
  const yesterday = Date.parse(now.toISOString().slice(0, 10)) - 86400000;
  const endMs = Math.min(startMs + 6 * 86400000, yesterday);
  const date = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return {
    start: week,
    end: date(endMs),
    previousStart: date(startMs - 7 * 86400000),
    previousEnd: date(endMs - 7 * 86400000),
    days: Math.max(0, Math.round((endMs - startMs) / 86400000) + 1),
  };
}
