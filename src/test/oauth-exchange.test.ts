// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { exchangeAndDeliver } from "../../scripts/oauth-exchange";

describe("OAuth private delivery", () => {
  const secret = "synthetic-sensitive-sentinel";
  it("delivers only to the private sink, never to logs", async () => {
    const logs = vi.fn(),
      sink = vi.fn().mockResolvedValue(undefined);
    expect(
      await exchangeAndDeliver(
        async () => ({
          ok: true,
          json: async () => ({ refresh_token: secret, access_token: secret }),
        }),
        sink,
        logs,
      ),
    ).toBe(true);
    expect(sink).toHaveBeenCalledWith(secret);
    expect(JSON.stringify(logs.mock.calls)).not.toContain(secret);
  });
  it.each(["provider", "exception", "delivery", "json", "missing"])(
    "sanitizes %s failures",
    async (kind) => {
      const logs = vi.fn(),
        sink = vi.fn(async () => {
          if (kind === "delivery") throw new Error(secret);
        });
      const exchange = async () => {
        if (kind === "exception") throw new Error(secret);
        return {
          ok: kind !== "provider",
          json: async () => {
            if (kind === "json") throw new Error(secret);
            return kind === "missing"
              ? {}
              : {
                  refresh_token: secret,
                  ...(kind === "provider"
                    ? { error: secret, error_description: secret }
                    : {}),
                };
          },
        };
      };
      expect(await exchangeAndDeliver(exchange, sink, logs)).toBe(false);
      expect(JSON.stringify(logs.mock.calls)).not.toContain(secret);
      if (kind !== "delivery") expect(sink).not.toHaveBeenCalled();
    },
  );
});
