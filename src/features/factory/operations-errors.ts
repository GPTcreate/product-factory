const MESSAGES: Record<string, string> = {
  "Values required": "저장할 내용을 입력해 주세요.",
  "Valid product required": "제품을 다시 선택해 주세요.",
  "Product not found": "제품을 찾을 수 없습니다. 목록을 새로고침해 주세요.",
  "Record not found": "기록을 찾을 수 없습니다. 목록을 새로고침해 주세요.",
  "Save a review goal first": "평가 목표를 먼저 저장해 주세요.",
  "Choose a metric and positive target":
    "평가 지표와 0보다 큰 목표를 입력해 주세요.",
  "Window must be 7–90 days and coverage must fit the window":
    "평가 기간은 7~90일로, 필요 관측 일수는 그 기간 안으로 입력해 주세요.",
  "Decision and review notes required":
    "운영자 판단과 판단 근거를 확인해 주세요.",
  "Use a public evidence URL without credentials and notes up to 5000 characters":
    "인증정보가 없는 공개 근거 주소를 사용하고 설명은 5,000자 이내로 입력해 주세요.",
  "Invalid checklist item or status":
    "출시 준비 항목과 확인 상태를 다시 선택해 주세요.",
  "Ready items need evidence or verification notes":
    "확인 완료로 저장하려면 근거 주소나 확인 내용을 입력해 주세요.",
  "Invalid task title, owner, status or priority":
    "작업 제목·담당자·상태·우선순위를 확인해 주세요.",
  "Invalid task ID": "작업을 찾을 수 없습니다. 목록을 새로고침해 주세요.",
  "Invalid due date": "올바른 기한을 입력해 주세요.",
  "Week must start on Monday": "연결할 주는 월요일 날짜를 선택해 주세요.",
  "Completed tasks need evidence or completion notes":
    "완료로 저장하려면 근거 주소나 완료 내용을 입력해 주세요.",
  "Missing Authorization header": "로그인 상태를 확인하고 다시 시도해 주세요.",
  "Invalid or expired session":
    "로그인이 만료되었습니다. 다시 로그인해 주세요.",
  "MFA verification (aal2) required":
    "2단계 인증을 완료한 뒤 다시 저장해 주세요.",
  "Not an authorized admin": "관리자 권한을 확인해 주세요.",
  "Week is required": "관리할 주를 선택해 주세요.",
  "Invalid product": "제품을 다시 선택해 주세요.",
  "Title, problem and language are required":
    "아이디어 제목·해결할 문제·언어를 입력해 주세요.",
  "Rate all eight criteria from 0 to 5":
    "평가 항목 8개를 각각 0~5점으로 입력해 주세요.",
};

/** Translate known public validation messages; never echo arbitrary server text. */
export function operationsSaveError(payload?: unknown): string {
  const body =
    payload && typeof payload === "object"
      ? (payload as { message?: unknown; error?: unknown })
      : undefined;
  if (typeof body?.message === "string" && MESSAGES[body.message])
    return MESSAGES[body.message];
  if (body?.error === "auth_error")
    return "로그인이 만료되었거나 확인되지 않았습니다. 다시 로그인해 주세요.";
  if (body?.error === "permission_denied")
    return "관리자 권한과 2단계 인증 상태를 확인해 주세요.";
  return "저장하지 못했습니다. 입력 내용과 로그인·연결 상태를 확인한 뒤 다시 시도해 주세요.";
}

export async function operationsInvocationError(
  error: unknown,
): Promise<string> {
  try {
    const context = (error as { context?: Response } | null)?.context;
    if (context && typeof context.json === "function")
      return operationsSaveError(await context.json());
  } catch {
    // Network errors and non-JSON responses use the same safe fallback.
  }
  return operationsSaveError();
}
