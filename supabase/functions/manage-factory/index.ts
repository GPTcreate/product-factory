import { preflight, corsHeaders } from "../_shared/cors.ts";
import { json } from "../_shared/response.ts";
import { requireAdminMfa } from "../_shared/auth.ts";
import { normalizeError } from "../_shared/errors.ts";
import { parseIdea, parseWeek } from "../_shared/factory-input.ts";
import { isUuid } from "../_shared/validate.ts";
import { saveOperations } from "../_shared/operations-handler.ts";
Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);
  try {
    if (req.method !== "POST")
      return json(405, { ok: false, error: "method_not_allowed" }, cors);
    const { admin, userId } = await requireAdminMfa(req);
    const body = await req.json().catch(() => null);
    if (body?.action === "alert.ack") {
      if (!isUuid(body.id))
        return json(400, { ok: false, message: "Valid alert required" }, cors);
      const { data, error } = await admin
        .from("operational_alerts")
        .update({ acknowledged_at: new Date().toISOString() })
        .eq("id", body.id)
        .is("resolved_at", null)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return json(data ? 200 : 404, { ok: !!data, result: data }, cors);
    }
    if (
      body &&
      ["launch.save", "task.save", "goal.save", "review.save"].includes(
        body.action,
      )
    ) {
      const result = await saveOperations(
        admin,
        userId,
        body.action,
        body.values,
      );
      return json(result.status, result.body, cors);
    }
    if (body?.action === "system.inspect") {
      const names = [
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "GOOGLE_REFRESH_TOKEN",
        "BING_WEBMASTER_API_KEY",
        "AUTOMATION_SECRET",
        "ADSENSE_ACCOUNT",
      ];
      return json(
        200,
        {
          ok: true,
          result: Object.fromEntries(
            names.map((name) => [name, !!Deno.env.get(name)]),
          ),
        },
        cors,
      );
    }
    if (body?.action === "automation.prepare") {
      const secret = Deno.env.get("AUTOMATION_SECRET");
      if (!secret || secret.length < 32)
        return json(
          400,
          {
            ok: false,
            message:
              "Existing Edge AUTOMATION_SECRET is missing or too short. Configure it securely first; no credential was changed.",
          },
          cors,
        );
      const result = await admin.rpc("prepare_factory_automation", {
        p_secret: secret,
      });
      if (result.error) throw result.error;
      return json(
        result.data ? 200 : 409,
        {
          ok: !!result.data,
          result: !!result.data,
          message: result.data
            ? undefined
            : "Existing Vault and Edge credentials differ. Preserved both values.",
        },
        cors,
      );
    }
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
