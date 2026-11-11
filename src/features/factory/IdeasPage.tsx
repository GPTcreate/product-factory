import { useState } from "react";
import { useIdeas, useFactoryMutation } from "./api";
import {
  EMPTY_SCORES,
  MARKETS,
  PRODUCT_STATUSES,
  SCORE_WEIGHTS,
  opportunityScore,
  type Idea,
} from "../../../supabase/functions/_shared/product";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { usePrivacyMode } from "@/lib/privacy";
import { PRODUCT_STATUS_LABELS } from "./operations-labels";
const MARKET_LABELS: Record<string, string> = {
  All: "전체",
  Korea: "한국",
  English: "영어권",
  Global: "글로벌",
};
const blank = {
  title: "",
  problem: "",
  target_user: "",
  market: "Korea",
  primary_language: "ko",
  acquisition_channel: "",
  repeat_usage_potential: "",
  ad_potential: "",
  premium_potential: "",
  competition: "",
  build_difficulty: "",
  maintenance_risk: "",
  level_candidate: 1,
  scores: { ...EMPTY_SCORES },
  evidence: "",
  notes: "",
  status: "IDEA",
} as Omit<Idea, "id" | "created_at" | "updated_at" | "opportunity_score">;
const fields = {
  problem: "해결할 문제·충족되지 않은 요구",
  target_user: "대상 사용자",
  acquisition_channel: "사용자 유입 경로",
  repeat_usage_potential: "반복 사용 가능성",
  ad_potential: "광고 수익 가능성",
  premium_potential: "다음 버전 유료화 가능성",
  competition: "경쟁·차별점",
  build_difficulty: "개발 난이도",
  maintenance_risk: "유지보수 위험",
  evidence: "근거·출처 URL",
  notes: "메모",
} as const;
const scoreLabels = {
  utility: "실용성",
  organic: "자연 유입 가능성",
  repeat: "반복 사용 가능성",
  advertising: "광고·페이지 조회 수",
  premium: "다음 버전 유료 기능",
  differentiation: "차별성",
  automation: "운영 자동화 가능성",
  one_week: "일주일 내 최소 기능 구현",
};
export function IdeasPage() {
  const query = useIdeas(),
    mutation = useFactoryMutation(),
    privacy = usePrivacyMode();
  const [editing, setEditing] = useState<Idea | null | undefined>(undefined);
  const [filter, setFilter] = useState("All");
  const [deleting, setDeleting] = useState<string | null>(null);
  const ideas = (query.data ?? []).filter(
    (i) => filter === "All" || i.market === filter,
  );
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            다음에 만들 제품을 찾아보세요
          </p>
          <h1 className="mt-2 text-2xl font-semibold">아이디어</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            아이디어와 시장을 함께 평가합니다. 점수보다 근거를 먼저 확인하세요.
          </p>
        </div>
        <Button
          onClick={() => {
            mutation.reset();
            setEditing(null);
          }}
        >
          아이디어 추가
        </Button>
      </header>
      <label className="block max-w-xs text-sm">
        시장
        <select
          className="factory-input"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {["All", ...MARKETS].map((v) => (
            <option key={v} value={v}>
              {MARKET_LABELS[v] ?? v}
            </option>
          ))}
        </select>
      </label>
      {query.isLoading && <p>아이디어를 불러오는 중…</p>}
      {query.isError && <ErrorState onRetry={() => void query.refetch()} />}
      {mutation.isError && (
        <p role="alert" className="text-critical">
          {mutation.error.message}
        </p>
      )}
      {query.data && (
        <div className="factory-panel overflow-x-auto">
          <table className="factory-table">
            <thead>
              <tr>
                <th>아이디어·문제</th>
                <th>시장</th>
                <th>평가 점수 / 100</th>
                <th>단계</th>
                <th>사업 상태</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {ideas.map((i) => (
                <tr key={i.id}>
                  <td>
                    <button
                      className="font-medium text-primary"
                      onClick={() => setEditing(i)}
                    >
                      {privacy.maskText(i.title)}
                    </button>
                    <p className="mt-1 max-w-sm truncate text-xs text-muted-foreground">
                      {privacy.maskText(i.problem)}
                    </p>
                  </td>
                  <td>
                    {MARKET_LABELS[i.market] ?? i.market} · {i.primary_language}
                  </td>
                  <td>
                    <b>{i.opportunity_score}</b>
                  </td>
                  <td>{i.level_candidate}단계</td>
                  <td>
                    <span className="factory-tag">
                      {PRODUCT_STATUS_LABELS[i.status]}
                    </span>
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleting(i.id)}
                    >
                      삭제
                    </Button>
                    {deleting === i.id && (
                      <div className="mt-2 space-x-2">
                        <span>이 아이디어를 삭제할까요?</span>
                        <Button
                          size="sm"
                          variant="danger"
                          loading={mutation.isPending}
                          onClick={() =>
                            mutation.mutate(
                              { action: "idea.delete", id: i.id },
                              { onSuccess: () => setDeleting(null) },
                            )
                          }
                        >
                          삭제 확인
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleting(null)}
                        >
                          유지
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!ideas.length && (
            <p className="py-8 text-center text-muted-foreground">
              이 시장에 등록한 아이디어가 없습니다.
            </p>
          )}
        </div>
      )}
      {editing !== undefined && (
        <IdeaEditor
          key={editing?.id ?? "new"}
          idea={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}
function IdeaEditor({
  idea,
  onClose,
}: {
  idea: Idea | null;
  onClose: () => void;
}) {
  const [value, setValue] = useState(idea ?? blank),
    mutation = useFactoryMutation();
  const set = (key: string, v: unknown) =>
    setValue((old) => ({ ...old, [key]: v }));
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4">
      <form
        className="factory-panel mx-auto my-8 max-w-3xl space-y-4 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="아이디어 평가"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(
            {
              action: idea ? "idea.update" : "idea.create",
              id: idea?.id,
              values: value,
            },
            { onSuccess: onClose },
          );
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {idea ? "아이디어 편집" : "새 아이디어"} ·{" "}
            {opportunityScore(value.scores)}
            /100
          </h2>
          <Button type="button" variant="ghost" onClick={onClose}>
            닫기
          </Button>
        </div>
        <label className="block text-sm">
          제목
          <input
            className="factory-input"
            required
            maxLength={200}
            value={value.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            시장
            <select
              className="factory-input"
              value={value.market}
              onChange={(e) => set("market", e.target.value)}
            >
              {MARKETS.map((v) => (
                <option key={v} value={v}>
                  {MARKET_LABELS[v] ?? v}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            언어 코드
            <input
              className="factory-input"
              required
              value={value.primary_language}
              onChange={(e) => set("primary_language", e.target.value)}
            />
          </label>
          <label className="text-sm">
            검토 단계
            <select
              className="factory-input"
              value={value.level_candidate}
              onChange={(e) => set("level_candidate", Number(e.target.value))}
            >
              {[1, 2, 3].map((v) => (
                <option key={v} value={v}>
                  {v}단계
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            사업 상태
            <select
              className="factory-input"
              value={value.status}
              onChange={(e) => set("status", e.target.value)}
            >
              {PRODUCT_STATUSES.map((v) => (
                <option key={v} value={v}>
                  {PRODUCT_STATUS_LABELS[v]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(fields).map(([key, label]) => (
            <label key={key} className="text-sm">
              {label}
              <textarea
                className="factory-input"
                rows={2}
                required={key === "problem"}
                maxLength={5000}
                value={value[key as keyof typeof fields]}
                onChange={(e) => set(key, e.target.value)}
              />
            </label>
          ))}
        </div>
        <fieldset className="rounded-lg bg-muted p-4">
          <legend className="font-medium">기회 평가 점수 · 항목별 0~5점</legend>
          <p className="mb-3 text-xs text-muted-foreground">
            5점이 가장 유리한 조건입니다. 경쟁·유지보수 부담이 낮고 일주일 내
            최소 기능 구현이 가능한 경우도 높은 점수로 평가하세요.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(SCORE_WEIGHTS).map(([key, weight]) => (
              <label key={key} className="text-sm">
                {scoreLabels[key as keyof typeof scoreLabels]} · {weight}%
                <select
                  className="factory-input"
                  value={value.scores[key as keyof typeof value.scores]}
                  onChange={(e) =>
                    set("scores", {
                      ...value.scores,
                      [key]: Number(e.target.value),
                    })
                  }
                >
                  {[0, 1, 2, 3, 4, 5].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </fieldset>
        {mutation.isError && (
          <p role="alert" className="text-critical">
            {mutation.error.message}
          </p>
        )}
        <Button loading={mutation.isPending} type="submit">
          아이디어 저장
        </Button>
      </form>
    </div>
  );
}
