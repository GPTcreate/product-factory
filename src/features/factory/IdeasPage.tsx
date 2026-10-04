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
  problem: "Problem / unmet need",
  target_user: "Target user",
  acquisition_channel: "Acquisition channel",
  repeat_usage_potential: "Repeat usage",
  ad_potential: "Advertising potential",
  premium_potential: "V2 premium potential",
  competition: "Competition / differentiation",
  build_difficulty: "Build difficulty",
  maintenance_risk: "Maintenance risk",
  evidence: "Evidence / source URLs",
  notes: "Notes",
} as const;
const scoreLabels = {
  utility: "Utility",
  organic: "Organic acquisition",
  repeat: "Repeat usage",
  advertising: "Advertising / PV",
  premium: "V2 premium",
  differentiation: "Differentiation",
  automation: "Automated operation",
  one_week: "One-week MVP",
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
            Discover the next asset
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Ideas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Idea × market evaluation. Evidence first, score second.
          </p>
        </div>
        <Button
          onClick={() => {
            mutation.reset();
            setEditing(null);
          }}
        >
          Add idea
        </Button>
      </header>
      <label className="block max-w-xs text-sm">
        Market
        <select
          className="factory-input"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {["All", ...MARKETS].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      {query.isLoading && <p>Loading ideas…</p>}
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
                <th>Idea / problem</th>
                <th>Market</th>
                <th>Score / 100</th>
                <th>Level</th>
                <th>Status</th>
                <th>Actions</th>
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
                    {i.market} · {i.primary_language}
                  </td>
                  <td>
                    <b>{i.opportunity_score}</b>
                  </td>
                  <td>L{i.level_candidate}</td>
                  <td>
                    <span className="factory-tag">{i.status}</span>
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleting(i.id)}
                    >
                      Delete
                    </Button>
                    {deleting === i.id && (
                      <div className="mt-2 space-x-2">
                        <span>Delete this idea?</span>
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
                          Confirm delete
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleting(null)}
                        >
                          Keep
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
              No ideas in this market yet.
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
        aria-label="Idea evaluation"
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
            {idea ? "Edit idea" : "New idea"} · {opportunityScore(value.scores)}
            /100
          </h2>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <label className="block text-sm">
          Title
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
            Market
            <select
              className="factory-input"
              value={value.market}
              onChange={(e) => set("market", e.target.value)}
            >
              {MARKETS.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Language
            <input
              className="factory-input"
              required
              value={value.primary_language}
              onChange={(e) => set("primary_language", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Candidate level
            <select
              className="factory-input"
              value={value.level_candidate}
              onChange={(e) => set("level_candidate", Number(e.target.value))}
            >
              {[1, 2, 3].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Status
            <select
              className="factory-input"
              value={value.status}
              onChange={(e) => set("status", e.target.value)}
            >
              {PRODUCT_STATUSES.map((v) => (
                <option key={v}>{v}</option>
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
          <legend className="font-medium">
            Opportunity score · 0–5 ratings
          </legend>
          <p className="mb-3 text-xs text-muted-foreground">
            5 is most favorable, including low competition, low maintenance and
            a feasible one-week MVP.
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
                    <option key={v}>{v}</option>
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
          Save idea
        </Button>
      </form>
    </div>
  );
}
