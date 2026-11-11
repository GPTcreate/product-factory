import type { SyncStatus, TriggerType } from "@/types/database";

// Display labels only; filtering and API values remain the original enums.
export const SYNC_STATUS_LABELS: Record<SyncStatus, string> = {
  success: "성공",
  partial: "일부 수집",
  failed: "실패",
  running: "실행 중",
};

export const SYNC_TRIGGER_LABELS: Record<TriggerType, string> = {
  scheduled: "예약 실행",
  manual: "수동 실행",
  backfill: "과거 자료 수집",
};
