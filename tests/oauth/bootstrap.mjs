// All provider calls are intercepted inside the helper process before import.
globalThis.fetch = async () => {
  const kind = process.env.OAUTH_FIXTURE_KIND;
  if (kind === "exception") throw new Error("synthetic-sensitive-sentinel");
  return {
    ok: kind !== "provider",
    json: async () => {
      if (kind === "json") throw new Error("synthetic-sensitive-sentinel");
      return kind === "provider"
        ? { error: "synthetic-sensitive-sentinel" }
        : { refresh_token: "synthetic-sensitive-sentinel".repeat(kind === "large" ? 8192 : 1) };
    },
  };
};
await import("../../scripts/google-oauth.ts");
