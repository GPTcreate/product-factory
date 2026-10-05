const knownCodes = new Set([
  "invalid_credentials",
  "over_request_rate_limit",
  "over_email_send_rate_limit",
  "request_timeout",
  "captcha_failed",
  "unexpected_failure",
]);

/** Never expose an error's raw message, credentials, or request/response body. */
export function describeLoginError(error: unknown) {
  const value = error && typeof error === "object" ? error : {};
  const code = "code" in value ? value.code : undefined;
  const name = "name" in value ? value.name : undefined;
  const rawStatus = "status" in value ? value.status : undefined;
  const status =
    typeof rawStatus === "number" &&
    Number.isInteger(rawStatus) &&
    rawStatus >= 0 &&
    rawStatus <= 599
      ? rawStatus
      : undefined;
  const message = "message" in value ? value.message : undefined;
  let category = "unknown";
  let text =
    "Unable to sign in. Please try again or contact the administrator.";

  if (code === "invalid_credentials") {
    category = "credentials";
    text = "Invalid email or password.";
  } else if (
    status === 429 ||
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit"
  ) {
    category = "rate_limit";
    text = "Too many sign-in attempts. Wait a few minutes before trying again.";
  } else if (typeof status === "number" && status >= 500) {
    category = "service";
    text =
      "The sign-in service is temporarily unavailable. Please try again later.";
  } else if (
    (name === "AuthRetryableFetchError" && status === 0) ||
    code === "request_timeout" ||
    (name === "TypeError" &&
      typeof message === "string" &&
      /Failed to fetch|NetworkError|Load failed/i.test(message))
  ) {
    category = "network";
    text =
      "Could not reach the sign-in service. Check your connection and try again.";
  } else if (name === "SecurityError" || name === "QuotaExceededError") {
    category = "browser_storage";
    text =
      "The browser could not save the session. Check its storage and privacy settings.";
  } else if (message === "Invalid API key") {
    category = "configuration";
    text =
      "The sign-in service configuration is invalid. Contact the administrator.";
  } else if (code === "captcha_failed") {
    category = "verification";
    text = "The security check could not be completed. Please try again.";
  }

  return {
    text,
    diagnostic: {
      category,
      status,
      code: typeof code === "string" && knownCodes.has(code) ? code : undefined,
    },
  };
}
