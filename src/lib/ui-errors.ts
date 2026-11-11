const MESSAGES: Record<string, string> = {
  "Request body must be a JSON object": "입력 내용을 확인해 주세요.",
  "Name is required (max 120 characters)":
    "제품 이름을 120자 이내로 입력해 주세요.",
  "Enter a valid domain, e.g. example.com":
    "example.com 형식의 올바른 도메인을 입력해 주세요.",
  "Website URL must start with http:// or https://":
    "사이트 주소는 http:// 또는 https://로 시작해야 합니다.",
  "Product code must be P001–P999999":
    "제품 코드는 P001~P999999 형식으로 입력해 주세요.",
  "Invalid market": "대상 시장을 다시 선택해 주세요.",
  "Invalid status": "제품 상태를 다시 선택해 주세요.",
  "Level must be 1, 2 or 3": "제품 단계는 1·2·3 중에서 선택해 주세요.",
  "Invalid launch date": "올바른 출시일을 입력해 주세요.",
  "AdSense mapping must be an exact verified site domain":
    "AdSense에서 확인한 사이트 도메인을 정확히 입력해 주세요.",
  "AdSense requires its verified site domain":
    "AdSense를 사용하려면 확인된 사이트 도메인이 필요합니다.",
  "Invalid AdSense enabled flag": "AdSense 사용 설정을 확인해 주세요.",
  "That domain, product code or AdSense mapping is already tracked.":
    "이미 등록된 도메인·제품 코드 또는 AdSense 연결입니다.",
  "Collection failed. Open the original Sync history error.":
    "수집에 실패했습니다. 수집 이력에서 원본 오류를 확인하세요.",
  "Partial collection. Inspect missing breakdowns.":
    "자료가 일부만 수집되었습니다. 누락된 상세 항목을 확인하세요.",
  "Collection has been running for more than 30 minutes.":
    "수집이 30분 넘게 진행 중입니다. 실행 상태를 확인하세요.",
  "Stored data is outside the freshness window.":
    "저장된 자료가 최신성 기준을 넘겼습니다.",
  "No successful collection has been verified.":
    "정상 수집에 성공한 이력이 아직 확인되지 않았습니다.",
  "Missing Authorization header": "로그인 상태를 확인해 주세요.",
  "Invalid or expired session":
    "로그인이 만료되었습니다. 다시 로그인해 주세요.",
  "MFA verification (aal2) required":
    "2단계 인증을 완료한 뒤 다시 시도해 주세요.",
  "Not an authorized admin": "관리자 권한이 필요합니다.",
};

const CODE_LABELS: Record<string, string> = {
  auth_error: "로그인 상태를 확인하고 다시 시도해 주세요.",
  invalid_credentials: "연결 인증 정보를 확인해 주세요.",
  permission_denied: "접근 권한과 2단계 인증 상태를 확인해 주세요.",
  config_missing: "연결에 필요한 설정이 없습니다. 제품 설정을 확인하세요.",
  rate_limited: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  provider_error: "공급자 응답에 오류가 있습니다. 수집 이력을 확인하세요.",
  timeout: "요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.",
  network_error: "연결할 수 없습니다. 네트워크 상태를 확인하세요.",
  validation_error: "입력 내용을 확인한 뒤 다시 시도해 주세요.",
  conflict: "다른 실행 또는 기존 기록과 충돌했습니다. 최신 상태를 확인하세요.",
  not_implemented: "아직 지원하지 않는 작업입니다.",
};

const FIELD_LABELS: Record<string, string> = {
  primary_language: "대표 언어",
  version: "버전",
  github_repo: "소스 저장소",
  deploy_url: "배포 주소",
};

/** Public display translation; unknown provider/server details are not echoed. */
export function readableError(
  error: unknown,
  fallback = "요청을 처리하지 못했습니다. 입력 내용과 연결 상태를 확인해 주세요.",
): string {
  const body =
    error && typeof error === "object"
      ? (error as { message?: unknown; error?: unknown; code?: unknown })
      : undefined;
  const message = typeof error === "string" ? error : body?.message;
  if (typeof message === "string") {
    if (MESSAGES[message]) return MESSAGES[message];
    if (/[가-힣]/.test(message)) return message;
    const match =
      /^Invalid (primary_language|version|github_repo|deploy_url)(?: URL)?$/.exec(
        message,
      );
    if (match) return `${FIELD_LABELS[match[1]]} 값을 확인해 주세요.`;
  }
  const code = body?.error ?? body?.code;
  return typeof code === "string" && CODE_LABELS[code]
    ? CODE_LABELS[code]
    : fallback;
}
