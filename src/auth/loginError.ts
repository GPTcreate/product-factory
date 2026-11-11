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
  let text = "로그인하지 못했습니다. 다시 시도하거나 관리자에게 문의하세요.";

  if (code === "invalid_credentials") {
    category = "credentials";
    text = "이메일 또는 비밀번호가 올바르지 않습니다.";
  } else if (
    status === 429 ||
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit"
  ) {
    category = "rate_limit";
    text = "로그인 시도가 너무 많습니다. 잠시 기다린 뒤 다시 시도하세요.";
  } else if (typeof status === "number" && status >= 500) {
    category = "service";
    text =
      "로그인 서비스를 일시적으로 이용할 수 없습니다. 잠시 후 다시 시도하세요.";
  } else if (
    (name === "AuthRetryableFetchError" && status === 0) ||
    code === "request_timeout" ||
    (name === "TypeError" &&
      typeof message === "string" &&
      /Failed to fetch|NetworkError|Load failed/i.test(message))
  ) {
    category = "network";
    text =
      "로그인 서비스에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도하세요.";
  } else if (name === "SecurityError" || name === "QuotaExceededError") {
    category = "browser_storage";
    text =
      "브라우저에 로그인 정보를 저장하지 못했습니다. 저장 공간과 개인정보 설정을 확인하세요.";
  } else if (message === "Invalid API key") {
    category = "configuration";
    text = "로그인 서비스 설정이 올바르지 않습니다. 관리자에게 문의하세요.";
  } else if (code === "captcha_failed") {
    category = "verification";
    text = "보안 확인을 완료하지 못했습니다. 다시 시도하세요.";
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
