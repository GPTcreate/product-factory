import { describe, expect, it } from "vitest";
import {
  parseOperations,
  periodValue,
  reviewSuggestion,
  reviewPeriod,
  weeklyRange,
  safeEvidence,
} from "../../supabase/functions/_shared/operations";
const id = "11111111-1111-4111-8111-111111111111";
const task = {
  site_id: id,
  title: "Fix measurement",
  status: "todo",
  priority: "high",
  owner: "Operator",
  due_date: null,
  week_start: "2026-10-19",
  evidence_url: "",
  notes: "",
};
describe("operational write contract", () => {
  it("whitelists fields rather than accepting injected IDs/privileges", () => {
    const parsed = parseOperations("task.save", {
      ...task,
      reviewed_by: "attacker",
      is_active: false,
    });
    expect(parsed.ok && parsed.value).not.toHaveProperty("reviewed_by");
    expect(parsed.ok && parsed.value).not.toHaveProperty("is_active");
  });
  it("requires evidence for a completed task and verified launch item", () => {
    expect(parseOperations("task.save", { ...task, status: "done" }).ok).toBe(
      false,
    );
    expect(
      parseOperations("task.save", {
        ...task,
        status: "done",
        notes: "Verified in production",
      }).ok,
    ).toBe(true);
    expect(
      parseOperations("launch.save", {
        site_id: id,
        item_key: "seo",
        status: "ready",
        evidence_url: "",
        notes: "",
      }).ok,
    ).toBe(false);
  });
  it("rejects invalid dates, a non-Monday week and cross-product malformed IDs", () => {
    expect(
      parseOperations("task.save", { ...task, week_start: "2026-10-20" }).ok,
    ).toBe(false);
    expect(
      parseOperations("task.save", { ...task, due_date: "2026-02-30" }).ok,
    ).toBe(false);
    expect(parseOperations("task.save", { ...task, site_id: "P001" }).ok).toBe(
      false,
    );
  });
  it.each([
    "javascript:alert(1)",
    "https://user:pass@example.com",
    "https://example.com?access_token=abc",
    "https://example.com?apikey=abc",
  ])("rejects credential-bearing/unsafe evidence %s", (value) =>
    expect(safeEvidence(value)).toBe(false),
  );
  it("rejects unattainable coverage and nonfinite/zero goals", () => {
    const goal = {
      site_id: id,
      metric: "sessions",
      target: 100,
      window_days: 7,
      minimum_days: 8,
    };
    expect(parseOperations("goal.save", goal).ok).toBe(false);
    expect(
      parseOperations("goal.save", {
        ...goal,
        minimum_days: 7,
        target: Infinity,
      }).ok,
    ).toBe(false);
    expect(
      parseOperations("goal.save", { ...goal, minimum_days: 7, target: 0 }).ok,
    ).toBe(false);
  });
});
describe("measured values and review", () => {
  const start = "2026-10-01",
    end = "2026-10-07";
  it("distinguishes missing data and measured zero", () => {
    expect(periodValue([], start, end).value).toBeNull();
    expect(
      periodValue([{ metric_date: start, value: 0 }], start, end).value,
    ).toBe(0);
  });
  it("uses calendar boundaries rather than last N available rows", () => {
    expect(
      periodValue(
        [
          { metric_date: "2026-09-30", value: 999 },
          { metric_date: "2026-10-03", value: 5 },
          { metric_date: "2026-10-08", value: 99 },
        ],
        start,
        end,
      ),
    ).toMatchObject({ value: 5, days: 1 });
  });
  it("does not count two engines/events on the same day as two coverage days", () => {
    expect(
      periodValue(
        [
          { metric_date: start, value: 1 },
          { metric_date: start, value: 2 },
        ],
        start,
        end,
      ).days,
    ).toBe(1);
  });
  it("refuses to combine currencies and invalid values", () => {
    expect(
      periodValue(
        [
          { metric_date: start, value: 1, currency: "USD" },
          { metric_date: end, value: 1000, currency: "KRW" },
        ],
        start,
        end,
      ),
    ).toMatchObject({ value: null, mixed: true });
    expect(
      periodValue([{ metric_date: start, value: NaN }], start, end).value,
    ).toBeNull();
  });
  it("defers partial/stale/failed collection and insufficient coverage", () => {
    const observed = { value: 100, days: 7, currency: null, mixed: false };
    expect(
      reviewSuggestion({ target: 10, minimum_days: 7 }, observed, false),
    ).toBe("INSUFFICIENT");
    expect(
      reviewSuggestion({ target: 10, minimum_days: 8 }, observed, true),
    ).toBe("INSUFFICIENT");
    expect(
      reviewSuggestion(
        { target: 10, minimum_days: 7 },
        { ...observed, value: 0 },
        true,
      ),
    ).toBe("IMPROVE");
    expect(
      reviewSuggestion({ target: 100, minimum_days: 7 }, observed, true),
    ).toBe("SCALE");
  });
  it("reviews completed UTC days and compares equal partial-week spans", () => {
    const now = new Date("2026-10-23T04:00:00Z");
    expect(reviewPeriod(7, now)).toEqual({
      start: "2026-10-16",
      end: "2026-10-22",
      previousStart: "2026-10-09",
      previousEnd: "2026-10-15",
    });
    expect(weeklyRange("2026-10-19", now)).toEqual({
      start: "2026-10-19",
      end: "2026-10-22",
      previousStart: "2026-10-12",
      previousEnd: "2026-10-15",
      days: 4,
    });
    expect(weeklyRange("2026-10-26", now).days).toBe(0);
  });
});
