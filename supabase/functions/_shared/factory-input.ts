import {
  MARKETS,
  PRODUCT_STATUSES,
  SCORE_WEIGHTS,
  opportunityScore,
  type Idea,
  type Scores,
  type FactoryWeek,
} from "./product.ts";
import { isUuid, type ParseResult } from "./validate.ts";
export function validDate(s: unknown): s is string {
  return (
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s
  );
}
export function parseIdea(
  body: unknown,
): ParseResult<Omit<Idea, "id" | "created_at" | "updated_at">> {
  if (!body || typeof body !== "object")
    return { ok: false, error: "Idea is required" };
  const b = body as Record<string, unknown>;
  const fields = [
    "title",
    "problem",
    "target_user",
    "primary_language",
    "acquisition_channel",
    "repeat_usage_potential",
    "ad_potential",
    "premium_potential",
    "competition",
    "build_difficulty",
    "maintenance_risk",
    "evidence",
    "notes",
  ] as const;
  const strings: Record<string, string> = {};
  for (const key of fields) {
    if (
      typeof b[key] !== "string" ||
      (b[key] as string).length > (key === "title" ? 200 : 5000)
    )
      return { ok: false, error: `Invalid ${key}` };
    strings[key] = (b[key] as string).trim();
  }
  if (!strings.title || !strings.problem || !strings.primary_language)
    return { ok: false, error: "Title, problem and language are required" };
  if (
    !(MARKETS as readonly unknown[]).includes(b.market) ||
    !(PRODUCT_STATUSES as readonly unknown[]).includes(b.status) ||
    ![1, 2, 3].includes(Number(b.level_candidate))
  )
    return { ok: false, error: "Invalid market, status or level" };
  if (!b.scores || typeof b.scores !== "object")
    return { ok: false, error: "Scores required" };
  const scores = Object.fromEntries(
    Object.keys(SCORE_WEIGHTS).map((key) => [
      key,
      (b.scores as Record<string, unknown>)[key],
    ]),
  ) as Scores;
  try {
    return {
      ok: true,
      value: {
        ...strings,
        market: b.market,
        status: b.status,
        level_candidate: Number(b.level_candidate),
        scores,
        opportunity_score: opportunityScore(scores),
      } as Omit<Idea, "id" | "created_at" | "updated_at">,
    };
  } catch {
    return { ok: false, error: "Rate all eight criteria from 0 to 5" };
  }
}
export function parseWeek(
  body: unknown,
): ParseResult<Omit<FactoryWeek, "updated_at">> {
  if (!body || typeof body !== "object")
    return { ok: false, error: "Week is required" };
  const b = body as Record<string, unknown>;
  if (!validDate(b.week_start) || new Date(b.week_start).getUTCDay() !== 1)
    return { ok: false, error: "Week must start on Monday" };
  if (b.product_id !== null && !isUuid(b.product_id))
    return { ok: false, error: "Invalid product" };
  const values: Record<string, string> = {};
  for (const k of [
    "notes",
    "hypothesis",
    "success_metric",
    "result",
    "decision",
  ]) {
    if (typeof b[k] !== "string" || (b[k] as string).length > 5000)
      return { ok: false, error: `Invalid ${k}` };
    values[k] = (b[k] as string).trim();
  }
  return {
    ok: true,
    value: {
      ...values,
      week_start: b.week_start,
      product_id: b.product_id,
    } as Omit<FactoryWeek, "updated_at">,
  };
}
