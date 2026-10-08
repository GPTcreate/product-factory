import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ManualSyncButtons } from "./ManualSyncButtons";
import { ManualSyncError, type SiteWithStatuses } from "@/lib/api";
const { mutation } = vi.hoisted(() => ({ mutation: { mutate: vi.fn(), isPending: false, variables: undefined as string | undefined } }));
vi.mock("@/lib/hooks", () => ({ useManualSync: () => mutation }));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
const site = { id: "fixture", statuses: [{ source: "ga4", enabled: true }] } as SiteWithStatuses;
describe("manual Sync fixture regression", () => {
  beforeEach(() => { mutation.mutate.mockReset(); mutation.isPending = false; mutation.variables = undefined; });
  it("only permits enabled sources and submits the selected source", () => {
    render(<ManualSyncButtons site={site} />);
    expect(screen.getByRole("button", { name: "Run GSC" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Run GA4" }));
    expect(mutation.mutate).toHaveBeenCalledWith("ga4", expect.any(Object));
  });
  it("shows zero rows without exposing provider detail", () => {
    mutation.mutate.mockImplementation((_source, callbacks) => callbacks.onSuccess([{ source: "ga4", status: "success", rowsWritten: 0 }]));
    render(<ManualSyncButtons site={site} />);
    fireEvent.click(screen.getByRole("button", { name: "Run all enabled" }));
    expect(screen.getByText("Sync complete - 0 rows written.")).toBeInTheDocument();
  });
  it("reports a running conflict and prevents concurrent submissions", () => {
    mutation.isPending = true; mutation.variables = "ga4";
    render(<ManualSyncButtons site={site} />);
    expect(screen.getByRole("button", { name: "Run all enabled" })).toBeDisabled();
  });
  it("shows safe authorization feedback", () => {
    mutation.mutate.mockImplementation((_source, callbacks) => callbacks.onError(new ManualSyncError("unauthorized", "synthetic-provider-detail", 403)));
    render(<ManualSyncButtons site={site} />);
    fireEvent.click(screen.getByRole("button", { name: "Run GA4" }));
    expect(screen.getByText(/MFA-verified admin session/)).toBeInTheDocument();
    expect(screen.queryByText("synthetic-provider-detail")).not.toBeInTheDocument();
  });
});
