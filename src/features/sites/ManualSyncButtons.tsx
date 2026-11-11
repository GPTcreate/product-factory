import { useState } from "react";
import { useManualSync } from "@/lib/hooks";
import {
  ManualSyncError,
  type ManualSource,
  type ManualSyncOutcome,
  type SiteWithStatuses,
} from "@/lib/api";
import { SOURCES, SOURCE_SHORT } from "@/lib/sources";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

type Feedback = { tone: "success" | "error" | "info"; text: string };

export function ManualSyncButtons({ site }: { site: SiteWithStatuses }) {
  const mutation = useManualSync(site.id);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const enabledFor = (source: string) =>
    !!site.statuses.find((s) => s.source === source)?.enabled;
  const anyEnabled = SOURCES.some(enabledFor);
  const pending = mutation.isPending ? mutation.variables : null;

  const run = (source: ManualSource) => {
    setFeedback(null);
    mutation.mutate(source, {
      onSuccess: (runs: ManualSyncOutcome[]) => setFeedback(summarize(runs)),
      onError: (err) => setFeedback(toFeedback(err)),
    });
  };

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">수동 수집</h2>
      <div className="flex flex-wrap gap-2">
        {SOURCES.map((source) => (
          <Button
            key={source}
            variant="secondary"
            size="sm"
            disabled={!enabledFor(source) || mutation.isPending}
            loading={pending === source}
            onClick={() => run(source)}
          >
            {SOURCE_SHORT[source]} 수집
          </Button>
        ))}
        <Button
          size="sm"
          disabled={!anyEnabled || mutation.isPending}
          loading={pending === "all"}
          onClick={() => run("all")}
        >
          활성 소스 모두 수집
        </Button>
      </div>
      {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}
    </section>
  );
}

function summarize(runs: ManualSyncOutcome[]): Feedback {
  const ok = runs.filter(
    (r) => r.status === "success" || r.status === "partial",
  );
  const failed = runs.filter((r) => r.status === "failed");
  const conflict = runs.filter((r) => r.status === "conflict");

  if (failed.length && !ok.length) {
    return {
      tone: "error",
      text: "수집에 실패했습니다. 수집 이력에서 정리된 오류 내용을 확인하세요.",
    };
  }
  if (failed.length || conflict.length) {
    return {
      tone: "info",
      text: `문제가 있는 상태로 완료: 성공 ${ok.length}개, 실패 ${failed.length}개${
        conflict.length ? `, 이미 실행 중 ${conflict.length}개` : ""
      }`,
    };
  }
  const written = ok.reduce((t, r) => t + (r.rowsWritten ?? 0), 0);
  return {
    tone: "success",
    text: `수집 완료 · ${written}행 저장`,
  };
}

function toFeedback(err: unknown): Feedback {
  if (err instanceof ManualSyncError) {
    if (err.status === 409 || err.code === "already_running") {
      return {
        tone: "info",
        text: "이 연결의 수집이 이미 실행 중입니다.",
      };
    }
    if (err.status === 401 || err.status === 403) {
      return {
        tone: "error",
        text: "권한이 없습니다. 2단계 인증을 완료한 관리자 로그인이 필요합니다.",
      };
    }
  }
  return {
    tone: "error",
    text: "수집을 시작하지 못했습니다. 다시 시도하세요.",
  };
}
