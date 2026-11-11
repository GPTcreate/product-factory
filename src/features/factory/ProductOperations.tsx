import { useState } from "react";
import { Link } from "react-router-dom";
import {
  LAUNCH_ITEMS,
  REVIEW_METRICS,
  periodValue,
  reviewPeriod,
  reviewSuggestion,
  type LaunchCheck,
  type ProductTask,
  type ReviewGoal,
  type ReviewRecord,
} from "../../../supabase/functions/_shared/operations";
import { useProductOperations, useOperationsMutation } from "./operations-api";
import { useAnalyticsDetail, useRevenue } from "./api";
import { useSiteMetrics } from "@/lib/hooks";
import type { SiteWithStatuses } from "@/lib/api";
import { usePrivacyMode } from "@/lib/privacy";
import { Button } from "@/components/ui/button";
import { monday } from "./model";
import {
  LAUNCH_ITEM_LABELS,
  LAUNCH_STATUS_LABELS,
  OPERATION_SECTION_LABELS,
  REVIEW_DECISION_LABELS,
  REVIEW_METRIC_LABELS,
  REVIEW_SUGGESTION_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "./operations-labels";

type ProductOperationsProps = {
  site: SiteWithStatuses;
  section: "Launch" | "Work" | "Review";
};

export function ProductOperations(props: ProductOperationsProps) {
  return <ProductOperationsContent key={props.site.id} {...props} />;
}

function ProductOperationsContent({ site, section }: ProductOperationsProps) {
  const query = useProductOperations(site.id);
  const privacy = usePrivacyMode();
  if (privacy.enabled)
    return (
      <p className="factory-panel">
        전체 데이터 숨김이 켜져 있습니다. 운영 기록을 보거나 편집하려면
        해제하세요.
      </p>
    );
  if (query.isLoading) return <p role="status">운영 기록을 불러오는 중…</p>;
  if (query.isError || !query.data)
    return (
      <div className="factory-panel" role="alert">
        운영 기록을 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도하세요.{" "}
        <Button onClick={() => void query.refetch()}>
          운영 기록 다시 확인
        </Button>
      </div>
    );
  const data = query.data;
  return (
    <section
      className="space-y-4"
      aria-label={`${OPERATION_SECTION_LABELS[section]} 운영 기록`}
    >
      {section === "Launch" && (
        <>
          <header>
            <h2 className="font-semibold">출시 준비 체크리스트</h2>
            <p className="text-sm text-muted-foreground">
              운영자가 확인한 증거를 저장합니다. 체크 자체가 외부 서비스의 자동
              검증을 의미하지 않습니다.
            </p>
            <p className="text-sm">
              {data.checks.filter((c) => c.status === "ready").length} /{" "}
              {LAUNCH_ITEMS.length}개 준비 완료
            </p>
          </header>
          {LAUNCH_ITEMS.map((item) => {
            const saved = data.checks.find((c) => c.item_key === item);
            return (
              <LaunchEditor
                key={`${site.id}:${item}:${saved?.updated_at ?? "new"}`}
                siteId={site.id}
                item={item}
                saved={saved}
              />
            );
          })}
        </>
      )}
      {section === "Work" && (
        <>
          <header>
            <h2 className="font-semibold">제품 개선 작업</h2>
            <p className="text-sm text-muted-foreground">
              작업 상태는 제품의 사업 상태·활성 여부와 별도로 관리합니다.
            </p>
            <Link className="text-primary underline" to="/factory">
              주간 관리 열기
            </Link>
          </header>
          <p className="text-sm" role="status">
            전체 {data.tasks.length}개 · 진행할 일{" "}
            {data.tasks.filter((task) => task.status !== "done").length}개 ·
            완료 {data.tasks.filter((task) => task.status === "done").length}개
          </p>
          <TaskEditor key={`${site.id}:new-task`} siteId={site.id} />
          {data.tasks.map((task) => (
            <details
              className="factory-panel"
              key={`${site.id}:${task.id}:${task.updated_at}`}
            >
              <summary className="min-h-[44px] cursor-pointer py-3">
                <span className="font-medium">{task.title}</span>{" "}
                <span className="text-sm text-muted-foreground">
                  {TASK_STATUS_LABELS[task.status]} · 우선순위{" "}
                  {TASK_PRIORITY_LABELS[task.priority]} ·{" "}
                  {task.due_date ?? "기한 미정"}
                </span>
              </summary>
              <TaskEditor siteId={site.id} saved={task} />
            </details>
          ))}
          {!data.tasks.length && <p>아직 등록한 개선 작업이 없습니다.</p>}
        </>
      )}
      {section === "Review" && (
        <>
          <GoalEditor
            key={`${site.id}:${data.goal?.updated_at ?? "new"}`}
            siteId={site.id}
            saved={data.goal}
          />
          {data.goal && (
            <ReviewPreview key={site.id} site={site} goal={data.goal} />
          )}
          <h3 className="font-semibold">평가 기록</h3>
          {!data.reviews.length && <p>아직 저장한 평가가 없습니다.</p>}
          {data.reviews.map((r) => (
            <article className="factory-panel space-y-1" key={r.id}>
              <p>
                {r.period_start} → {r.period_end} ·{" "}
                {REVIEW_METRIC_LABELS[r.metric]}
              </p>
              <p>
                관측 {r.observed ?? "자료 없음"} / 목표 {r.target} ·{" "}
                {r.coverage_days}일 관측
              </p>
              <p>
                규칙 제안:{" "}
                {REVIEW_SUGGESTION_LABELS[r.suggestion] ?? r.suggestion} ·
                운영자 판단: {REVIEW_DECISION_LABELS[r.decision]}
              </p>
              <p className="whitespace-pre-wrap break-words">{r.notes}</p>
              <p className="text-xs text-muted-foreground">{r.created_at}</p>
            </article>
          ))}
        </>
      )}
    </section>
  );
}

function LaunchEditor({
  siteId,
  item,
  saved,
}: {
  siteId: string;
  item: LaunchCheck["item_key"];
  saved?: LaunchCheck;
}) {
  const [status, setStatus] = useState(saved?.status ?? "pending");
  const [url, setUrl] = useState(saved?.evidence_url ?? "");
  const [notes, setNotes] = useState(saved?.notes ?? "");
  const mutation = useOperationsMutation(siteId);
  return (
    <form
      className="factory-panel space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate({
          action: "launch.save",
          values: {
            site_id: siteId,
            item_key: item,
            status,
            evidence_url: url,
            notes,
          },
        });
      }}
    >
      <fieldset disabled={mutation.isPending} className="min-w-0 space-y-3">
        <h3 className="font-medium">{LAUNCH_ITEM_LABELS[item]}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            확인 상태
            <select
              className="factory-input"
              aria-label={`${LAUNCH_ITEM_LABELS[item]} 확인 상태`}
              value={status}
              onChange={(e) => {
                mutation.reset();
                setStatus(e.target.value as LaunchCheck["status"]);
              }}
            >
              {["pending", "ready", "waiting", "not_applicable"].map((s) => (
                <option key={s} value={s}>
                  {LAUNCH_STATUS_LABELS[s as LaunchCheck["status"]]}
                </option>
              ))}
            </select>
          </label>
          <label>
            증거 URL
            <input
              className="factory-input"
              aria-label={`${LAUNCH_ITEM_LABELS[item]} 증거 URL`}
              type="url"
              maxLength={2048}
              value={url}
              onChange={(e) => {
                mutation.reset();
                setUrl(e.target.value);
              }}
            />
          </label>
        </div>
        <label className="block">
          확인 내용
          <textarea
            className="factory-input"
            aria-label={`${LAUNCH_ITEM_LABELS[item]} 확인 내용`}
            maxLength={5000}
            value={notes}
            onChange={(e) => {
              mutation.reset();
              setNotes(e.target.value);
            }}
          />
        </label>
        {saved?.verified_at && (
          <p className="text-xs">확인 시각 {saved.verified_at}</p>
        )}
        <MutationFeedback mutation={mutation} />
        <Button loading={mutation.isPending}>
          {LAUNCH_ITEM_LABELS[item]} 저장
        </Button>
      </fieldset>
    </form>
  );
}

function TaskEditor({
  siteId,
  saved,
}: {
  siteId: string;
  saved?: ProductTask;
}) {
  const empty = {
    site_id: siteId,
    title: "",
    status: "todo" as const,
    priority: "normal" as const,
    owner: "",
    due_date: null,
    week_start: null,
    evidence_url: "",
    notes: "",
  };
  const [value, setValue] = useState<
    Omit<ProductTask, "id" | "updated_at"> & { id?: string }
  >(saved ?? empty);
  const mutation = useOperationsMutation(siteId);
  const patch = (field: string, v: string | null) => {
    mutation.reset();
    setValue((previous) => ({ ...previous, [field]: v }));
  };
  return (
    <form
      className={saved ? "space-y-3 pt-4" : "factory-panel space-y-3"}
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(
          { action: "task.save", values: value },
          {
            onSuccess: () => {
              if (!saved) setValue(empty);
            },
          },
        );
      }}
    >
      <fieldset disabled={mutation.isPending} className="min-w-0 space-y-3">
        <h3 className="font-medium">{saved ? "작업 편집" : "새 개선 작업"}</h3>
        <label className="block">
          작업 제목
          <input
            required
            maxLength={200}
            className="factory-input"
            aria-label={saved ? `작업 제목 ${saved.id}` : "새 작업 제목"}
            value={value.title}
            onChange={(e) => patch("title", e.target.value)}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            상태
            <select
              className="factory-input"
              aria-label={saved ? `작업 상태 ${saved.id}` : "새 작업 상태"}
              value={value.status}
              onChange={(e) => patch("status", e.target.value)}
            >
              {["todo", "doing", "done", "blocked"].map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s as ProductTask["status"]]}
                </option>
              ))}
            </select>
          </label>
          <label>
            우선순위
            <select
              className="factory-input"
              value={value.priority}
              onChange={(e) => patch("priority", e.target.value)}
            >
              {["high", "normal", "low"].map((s) => (
                <option key={s} value={s}>
                  {TASK_PRIORITY_LABELS[s as ProductTask["priority"]]}
                </option>
              ))}
            </select>
          </label>
          <label>
            담당자
            <input
              className="factory-input"
              maxLength={120}
              value={value.owner}
              onChange={(e) => patch("owner", e.target.value)}
            />
          </label>
          <label>
            기한
            <input
              className="factory-input"
              type="date"
              value={value.due_date ?? ""}
              onChange={(e) => patch("due_date", e.target.value || null)}
            />
          </label>
          <label>
            연결할 주의 월요일
            <input
              className="factory-input"
              type="date"
              value={value.week_start ?? ""}
              onChange={(e) =>
                patch(
                  "week_start",
                  e.target.value ? monday(e.target.value) : null,
                )
              }
            />
            <span className="text-xs text-muted-foreground">
              날짜를 고르면 해당 주의 월요일로 저장합니다.
            </span>
          </label>
          <label>
            완료 증거 URL
            <input
              className="factory-input"
              type="url"
              maxLength={2048}
              value={value.evidence_url}
              onChange={(e) => patch("evidence_url", e.target.value)}
            />
          </label>
        </div>
        <label className="block">
          설명과 완료 근거
          <textarea
            className="factory-input"
            maxLength={5000}
            value={value.notes}
            onChange={(e) => patch("notes", e.target.value)}
          />
        </label>
        <MutationFeedback mutation={mutation} />
        <Button loading={mutation.isPending}>
          {saved ? "작업 변경 저장" : "개선 작업 추가"}
        </Button>
      </fieldset>
    </form>
  );
}

function GoalEditor({
  siteId,
  saved,
}: {
  siteId: string;
  saved: ReviewGoal | null;
}) {
  const [value, setValue] = useState({
    site_id: siteId,
    metric: saved?.metric ?? "sessions",
    target: saved?.target ?? 100,
    window_days: saved?.window_days ?? 28,
    minimum_days: saved?.minimum_days ?? 21,
  });
  const mutation = useOperationsMutation(siteId);
  return (
    <form
      className="factory-panel space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate({ action: "goal.save", values: value });
      }}
    >
      <fieldset disabled={mutation.isPending} className="min-w-0 space-y-3">
        <h2 className="font-semibold">출시 후 평가 목표</h2>
        <p className="text-sm text-muted-foreground">
          초기 입력값은 예시입니다. 제품의 실제 성공 기준으로 수정해 저장하세요.
          제품 상태를 자동 변경하지 않습니다.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            평가 지표
            <select
              className="factory-input"
              aria-label="평가 지표"
              value={value.metric}
              onChange={(e) => {
                mutation.reset();
                setValue({
                  ...value,
                  metric: e.target.value as ReviewGoal["metric"],
                });
              }}
            >
              {REVIEW_METRICS.map((m) => (
                <option key={m} value={m}>
                  {REVIEW_METRIC_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          {(
            [
              ["target", "목표 합계", 1, 1e12],
              ["window_days", "평가 기간 일수", 7, 90],
              ["minimum_days", "필요 관측 일수", 1, value.window_days],
            ] as const
          ).map(([field, label, min, max]) => (
            <label key={field}>
              {label}
              <input
                className="factory-input"
                aria-label={label}
                type="number"
                min={min}
                max={max}
                step={field === "target" ? "any" : 1}
                required
                value={value[field]}
                onChange={(e) => {
                  mutation.reset();
                  setValue({ ...value, [field]: Number(e.target.value) });
                }}
              />
            </label>
          ))}
        </div>
        <MutationFeedback mutation={mutation} />
        <Button loading={mutation.isPending}>평가 목표 저장</Button>
      </fieldset>
    </form>
  );
}

function ReviewPreview({
  site,
  goal,
}: {
  site: SiteWithStatuses;
  goal: ReviewGoal;
}) {
  const metrics = useSiteMetrics(site.id, goal.window_days);
  const details = useAnalyticsDetail(site.id, goal.window_days);
  const revenue = useRevenue(goal.window_days, site.id);
  const mutation = useOperationsMutation(site.id);
  const [decision, setDecision] = useState("DEFER");
  const [notes, setNotes] = useState("");
  const period = reviewPeriod(goal.window_days);
  const source =
    goal.metric === "revenue"
      ? "adsense"
      : goal.metric === "google_clicks"
        ? "gsc"
        : "ga4";
  const integration = site.statuses.find((s) => s.source === source);
  const query =
    goal.metric === "revenue"
      ? revenue
      : goal.metric === "core_action"
        ? details
        : metrics;
  const rows =
    goal.metric === "sessions"
      ? (metrics.data?.analytics ?? []).map((r) => ({
          metric_date: r.metric_date,
          value: r.sessions,
        }))
      : goal.metric === "core_action"
        ? (details.data?.events ?? [])
            .filter((r) => r.event_name === "core_action")
            .map((r) => ({ metric_date: r.metric_date, value: r.event_count }))
        : goal.metric === "google_clicks"
          ? (metrics.data?.search ?? [])
              .filter((r) => r.engine === "google")
              .map((r) => ({ metric_date: r.metric_date, value: r.clicks }))
          : (revenue.data ?? []).map((r) => ({
              metric_date: r.metric_date,
              value: Number(r.estimated_earnings),
              currency: r.currency_code,
            }));
  const observed = periodValue(rows, period.start, period.end);
  const fresh =
    integration?.last_success_at &&
    Date.now() - Date.parse(integration.last_success_at) < 72 * 3600000;
  const suggestion = reviewSuggestion(
    goal,
    observed,
    !query.isError &&
      !query.isLoading &&
      integration?.last_status === "success" &&
      !!fresh,
  );
  return (
    <form
      className="factory-panel space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate({
          action: "review.save",
          values: { site_id: site.id, decision, notes },
        });
      }}
    >
      <fieldset disabled={mutation.isPending} className="min-w-0 space-y-3">
        <h3 className="font-semibold">평가 미리보기</h3>
        <p>
          {period.start} → {period.end} · UTC 완료일 기준
        </p>
        {query.isError && (
          <p role="alert">지표 읽기 실패. 평가를 보류하고 다시 확인하세요.</p>
        )}
        <p>
          관측{" "}
          {query.isError
            ? "확인 불가"
            : query.isLoading
              ? "불러오는 중"
              : (observed.value ?? "자료 없음")}{" "}
          {observed.currency ?? ""} / 목표 {goal.target} · {observed.days}일
          관측
        </p>
        <p>
          규칙 제안:{" "}
          <strong>{REVIEW_SUGGESTION_LABELS[suggestion] ?? suggestion}</strong>
        </p>
        <p className="text-xs text-muted-foreground">
          최소 관측 일수, 최근 72시간 내 정상 수집을 충족해야 제안합니다. 목표
          100% 이상이면 확대, 50% 이상이면 유지·관찰, 그 외에는 개선을
          제안합니다. core_action은 명시된 이벤트 행이 있는 날짜만 셉니다.
          누락은 0으로 채우지 않습니다. 저장 시 서버가 실제 지표를 다시
          계산합니다.
        </p>
        <label className="block">
          운영자 판단
          <select
            className="factory-input"
            aria-label="운영자 판단"
            value={decision}
            onChange={(e) => {
              mutation.reset();
              setDecision(e.target.value);
            }}
          >
            {["DEFER", "HOLD", "IMPROVE", "SCALE", "V2"].map((s) => (
              <option key={s} value={s}>
                {REVIEW_DECISION_LABELS[s as ReviewRecord["decision"]]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          판단 근거
          <textarea
            className="factory-input"
            aria-label="평가 판단 근거"
            maxLength={5000}
            value={notes}
            onChange={(e) => {
              mutation.reset();
              setNotes(e.target.value);
            }}
          />
        </label>
        <MutationFeedback mutation={mutation} />
        <Button
          disabled={query.isError || query.isLoading}
          loading={mutation.isPending}
        >
          평가 기록 저장
        </Button>
      </fieldset>
    </form>
  );
}

function MutationFeedback({
  mutation,
}: {
  mutation: ReturnType<typeof useOperationsMutation>;
}) {
  return (
    <>
      {mutation.isError && (
        <p role="alert" className="text-critical">
          {mutation.error.message}
        </p>
      )}
      {mutation.isSuccess && (
        <p role="status" className="text-success">
          저장했습니다.
        </p>
      )}
    </>
  );
}
