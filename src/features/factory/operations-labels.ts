import type {
  LaunchCheck,
  ProductTask,
  ReviewGoal,
  ReviewRecord,
} from "../../../supabase/functions/_shared/operations";
import type { ProductStatus } from "../../../supabase/functions/_shared/product";

// Display labels only. Persisted values and API actions remain the shared enums.
export const LAUNCH_ITEM_LABELS: Record<LaunchCheck["item_key"], string> = {
  core_flow: "핵심 기능",
  mobile: "모바일",
  https: "HTTPS",
  seo: "SEO · 대표 URL · 공유 미리보기",
  sitemap: "사이트맵 · robots.txt",
  analytics: "GA4 태그 수신",
  core_event: "핵심 이벤트",
  search: "검색 소유권·등록",
  privacy: "개인정보 처리방침",
  terms: "이용약관",
  contact: "문의 연락처",
  deployment: "운영 배포",
  manual_sync: "실제 수동 수집",
  scheduled_sync: "예정 수집 검증",
};
export const LAUNCH_STATUS_LABELS: Record<LaunchCheck["status"], string> = {
  pending: "점검 전",
  ready: "준비 완료",
  waiting: "확인 대기",
  not_applicable: "해당 없음",
};
export const TASK_STATUS_LABELS: Record<ProductTask["status"], string> = {
  todo: "할 일",
  doing: "진행 중",
  done: "완료",
  blocked: "진행 막힘",
};
export const TASK_PRIORITY_LABELS: Record<ProductTask["priority"], string> = {
  high: "높음",
  normal: "보통",
  low: "낮음",
};
export const REVIEW_METRIC_LABELS: Record<ReviewGoal["metric"], string> = {
  sessions: "세션 수",
  core_action: "핵심 행동 이벤트 수",
  google_clicks: "Google 검색 클릭 수",
  revenue: "AdSense 수익",
};
export const REVIEW_DECISION_LABELS: Record<ReviewRecord["decision"], string> =
  {
    DEFER: "판단 보류",
    HOLD: "유지·관찰",
    IMPROVE: "개선",
    SCALE: "확대",
    V2: "다음 버전 준비",
  };
export const REVIEW_SUGGESTION_LABELS: Record<string, string> = {
  ...REVIEW_DECISION_LABELS,
  INSUFFICIENT: "자료 부족",
};
export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  IDEA: "아이디어",
  SPEC: "기획",
  BUILD: "개발",
  LIVE: "운영",
  HOLD: "보류",
  KILL: "중단",
  SCALE: "확대",
};
export const OPERATION_SECTION_LABELS = {
  Launch: "출시 준비",
  Work: "작업 현황",
  Review: "평가",
};
export const PRODUCT_DETAIL_TAB_LABELS: Record<string, string> = {
  Overview: "개요",
  Traffic: "방문 현황",
  Search: "검색 현황",
  Revenue: "수익",
  Events: "이벤트",
  Health: "연결 상태",
  ...OPERATION_SECTION_LABELS,
};
