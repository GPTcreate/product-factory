import { preflight, corsHeaders } from "../_shared/cors.ts";
import { json } from "../_shared/response.ts";
import { requireAdminMfa } from "../_shared/auth.ts";
import { normalizeError } from "../_shared/errors.ts";
import { parseIdea, parseWeek } from "../_shared/factory-input.ts";
import { isUuid } from "../_shared/validate.ts";
Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);
  try {
    if (req.method !== "POST")
      return json(405, { ok: false, error: "method_not_allowed" }, cors);
    const { admin } = await requireAdminMfa(req);
    const body = await req.json().catch(() => null);
    if (
      !body ||
      !["idea.create", "idea.update", "idea.delete", "week.save"].includes(
        body.action,
      )
    )
      return json(400, { ok: false, message: "Unknown action" }, cors);
    if (body.action === "week.save") {
      const parsed = parseWeek(body.values);
      if (!parsed.ok)
        return json(400, { ok: false, message: parsed.error }, cors);
      const { data, error } = await admin
        .from("factory_weeks")
        .upsert(parsed.value, { onConflict: "week_start" })
        .select()
        .single();
      if (error) throw error;
      return json(200, { ok: true, result: data }, cors);
    }
    if (body.action !== "idea.create" && !isUuid(body.id))
      return json(400, { ok: false, message: "Valid idea id required" }, cors);
    if (body.action === "idea.delete") {
      const { error } = await admin.from("ideas").delete().eq("id", body.id);
      if (error) throw error;
      return json(200, { ok: true }, cors);
    }
    const parsed = parseIdea(body.values);
    if (!parsed.ok)
      return json(400, { ok: false, message: parsed.error }, cors);
    const query =
      body.action === "idea.create"
        ? admin.from("ideas").insert(parsed.value)
        : admin.from("ideas").update(parsed.value).eq("id", body.id);
    const { data, error } = await query.select().maybeSingle();
    if (error) throw error;
    return json(data ? 200 : 404, { ok: !!data, result: data }, cors);
  } catch (err) {
    const n = normalizeError(err);
    return json(
      n.status ?? 500,
      { ok: false, error: n.code, message: n.message },
      cors,
    );
  }
});
