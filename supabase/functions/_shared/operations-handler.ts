import {
  parseOperations,
  periodValue,
  reviewPeriod,
  reviewSuggestion,
  type ReviewGoal,
} from "./operations.ts";
import type { SupabaseClient } from "./database.ts";

export async function saveOperations(
  admin: SupabaseClient,
  userId: string,
  action: string,
  input: unknown,
) {
  const parsed = parseOperations(action, input);
  if (!parsed.ok)
    return { status: 400, body: { ok: false, message: parsed.error } };
  const value = parsed.value;
  const site = await admin
    .from("sites")
    .select("id")
    .eq("id", value.site_id)
    .maybeSingle();
  if (site.error) throw site.error;
  if (!site.data)
    return { status: 404, body: { ok: false, message: "Product not found" } };
  let result;
  if (action === "launch.save")
    result = await admin
      .from("product_launch_checks")
      .upsert(
        {
          ...value,
          verified_at:
            value.status === "ready" ? new Date().toISOString() : null,
        },
        { onConflict: "site_id,item_key" },
      )
      .select()
      .single();
  else if (action === "task.save") {
    if (value.id)
      result = await admin
        .from("product_tasks")
        .update(value)
        .eq("id", value.id)
        .eq("site_id", value.site_id)
        .select()
        .maybeSingle();
    else
      result = await admin
        .from("product_tasks")
        .insert(value)
        .select()
        .single();
  } else if (action === "goal.save")
    result = await admin
      .from("product_review_goals")
      .upsert(value, { onConflict: "site_id" })
      .select()
      .single();
  else {
    const goalResult = await admin
      .from("product_review_goals")
      .select("*")
      .eq("site_id", value.site_id)
      .maybeSingle();
    if (goalResult.error) throw goalResult.error;
    const goal = goalResult.data as ReviewGoal | null;
    if (!goal)
      return {
        status: 400,
        body: { ok: false, message: "Save a review goal first" },
      };
    const period = reviewPeriod(goal.window_days);
    const source =
      goal.metric === "google_clicks"
        ? "gsc"
        : goal.metric === "revenue"
          ? "adsense"
          : "ga4";
    const table =
      goal.metric === "sessions"
        ? "analytics_daily"
        : goal.metric === "core_action"
          ? "analytics_event_daily"
          : goal.metric === "google_clicks"
            ? "search_daily"
            : "adsense_daily_metrics";
    const idKey = goal.metric === "revenue" ? "product_id" : "site_id";
    const column =
      goal.metric === "sessions"
        ? "sessions"
        : goal.metric === "core_action"
          ? "event_count"
          : goal.metric === "google_clicks"
            ? "clicks"
            : "estimated_earnings";
    let query = admin
      .from(table)
      .select("*")
      .eq(idKey, value.site_id)
      .gte("metric_date", period.start)
      .lte("metric_date", period.end);
    if (goal.metric === "core_action")
      query = query.eq("event_name", "core_action");
    if (goal.metric === "google_clicks") query = query.eq("engine", "google");
    // At most 90 daily rows for one product/metric, below the REST row cap.
    const [rows, integration] = await Promise.all([
      query,
      admin
        .from("integration_status")
        .select("last_status,last_success_at")
        .eq("site_id", value.site_id)
        .eq("source", source)
        .maybeSingle(),
    ]);
    if (rows.error) throw rows.error;
    if (integration.error) throw integration.error;
    const observed = periodValue(
      (rows.data ?? []).map((r: Record<string, unknown>) => ({
        metric_date: String(r.metric_date),
        value: Number(r[column]),
        currency: r.currency_code ? String(r.currency_code) : undefined,
      })),
      period.start,
      period.end,
    );
    const fresh =
      integration.data?.last_success_at &&
      Date.now() - Date.parse(integration.data.last_success_at) < 72 * 3600000;
    const reliable = integration.data?.last_status === "success" && !!fresh;
    result = await admin
      .from("product_reviews")
      .insert({
        site_id: value.site_id,
        period_start: period.start,
        period_end: period.end,
        metric: goal.metric,
        target: goal.target,
        observed: observed.value,
        coverage_days: observed.days,
        suggestion: reviewSuggestion(goal, observed, reliable),
        decision: value.decision,
        notes: value.notes,
        reviewed_by: userId,
      })
      .select()
      .single();
  }
  if (result.error) throw result.error;
  return {
    status: result.data ? 200 : 404,
    body: {
      ok: !!result.data,
      result: result.data,
      message: result.data ? undefined : "Record not found",
    },
  };
}
