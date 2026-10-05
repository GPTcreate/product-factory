import { describe, expect, it } from "vitest";
import { describeLoginError } from "./loginError";

describe("login error classification", () => {
  it.each([
    [{ code: "invalid_credentials", status: 400 }, "credentials"],
    [{ code: "over_request_rate_limit", status: 429 }, "rate_limit"],
    [{ name: "AuthRetryableFetchError", status: 503 }, "service"],
    [{ name: "AuthRetryableFetchError", status: 0 }, "network"],
    [new TypeError("Failed to fetch"), "network"],
    [{ code: "request_timeout" }, "network"],
    [new DOMException("blocked", "SecurityError"), "browser_storage"],
    [{ message: "Invalid API key", status: 401 }, "configuration"],
    [{ code: "captcha_failed", status: 400 }, "verification"],
    [{ code: "email_not_confirmed", status: 400 }, "unknown"],
    [{ status: 403 }, "unknown"],
    [null, "unknown"],
  ])("classifies %j as %s without blaming a password", (error, category) => {
    const result = describeLoginError(error);
    expect(result.diagnostic.category).toBe(category);
    expect(result.text === "Invalid email or password.").toBe(
      category === "credentials",
    );
  });

  it("never exposes raw errors or arbitrary error-code content", () => {
    const marker = "private-value-must-not-appear";
    const result = describeLoginError({
      message: marker,
      code: marker,
      name: marker,
      status: marker,
      request: { password: marker },
    });
    expect(JSON.stringify(result)).not.toContain(marker);
  });
});
