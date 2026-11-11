import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ManualSyncButtons } from "./ManualSyncButtons";
import { ManualSyncError, type SiteWithStatuses } from "@/lib/api";
const { mutation } = vi.hoisted(() => ({
  mutation: {
    mutate: vi.fn(),
    isPending: false,
    variables: undefined as string | undefined,
  },
}));
vi.mock("@/lib/hooks", () => ({ useManualSync: () => mutation }));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
const site = {
  id: "fixture",
  statuses: [{ source: "ga4", enabled: true }],
} as SiteWithStatuses;
describe("manual Sync fixture regression", () => {
  beforeEach(() => {
    mutation.mutate.mockReset();
    mutation.isPending = false;
    mutation.variables = undefined;
  });
  it("only permits enabled sources and submits the selected source", () => {
    render(<ManualSyncButtons site={site} />);
    expect(screen.getByRole("button", { name: "GSC 수집" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "GA4 수집" }));
    expect(mutation.mutate).toHaveBeenCalledWith("ga4", expect.any(Object));
  });
  it("shows zero rows without exposing provider detail", () => {
    mutation.mutate.mockImplementation((_source, callbacks) =>
      callbacks.onSuccess([
        { source: "ga4", status: "success", rowsWritten: 0 },
      ]),
    );
    render(<ManualSyncButtons site={site} />);
    fireEvent.click(
      screen.getByRole("button", { name: "활성 소스 모두 수집" }),
    );
    expect(screen.getByText("수집 완료 · 0행 저장")).toBeInTheDocument();
  });
  it("reports a running conflict and prevents concurrent submissions", () => {
    mutation.isPending = true;
    mutation.variables = "ga4";
    render(<ManualSyncButtons site={site} />);
    expect(
      screen.getByRole("button", { name: "활성 소스 모두 수집" }),
    ).toBeDisabled();
  });
  it("shows safe authorization feedback", () => {
    mutation.mutate.mockImplementation((_source, callbacks) =>
      callbacks.onError(
        new ManualSyncError("unauthorized", "synthetic-provider-detail", 403),
      ),
    );
    render(<ManualSyncButtons site={site} />);
    fireEvent.click(screen.getByRole("button", { name: "GA4 수집" }));
    expect(
      screen.getByText(/2단계 인증을 완료한 관리자 로그인/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("synthetic-provider-detail"),
    ).not.toBeInTheDocument();
  });
});
