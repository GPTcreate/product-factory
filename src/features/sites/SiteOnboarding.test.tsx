import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { SiteFormDialog } from "./SiteFormDialog";
import { onboardingError } from "@/lib/site-onboarding";
import { SaveSiteError, type SiteFormValues } from "@/lib/api";
import type { Site } from "@/types/database";
const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("@/lib/hooks", () => ({
  useSaveSite: () => ({ mutate, isPending: false }),
  useDeleteSite: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
const valid: SiteFormValues = {
  name: "Fixture",
  domain: "example.com",
  website_url: "https://example.com",
  product_code: "P123",
  gsc_property: "sc-domain:example.com",
  ga4_property_id: "123",
  bing_site_url: "https://example.com",
  is_active: false,
};
const site = {
  ...valid,
  id: "fixture",
  status: "LIVE",
  adsense_enabled: true,
  adsense_mapping_key: "example.com",
} as Site;

describe("product registration guidance", () => {
  beforeEach(() => {
    mutate.mockReset();
  });
  it("keeps new products inactive and saves valid values through the existing API", async () => {
    render(<SiteFormDialog mode="create" preset={valid} onClose={vi.fn()} />);
    expect(screen.getByLabelText("수집 활성화")).not.toBeChecked();
    expect(
      screen.getByRole("navigation", { name: "제품 등록 단계" }),
    ).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "제품 등록" }));
    });
    await vi.waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0]).toMatchObject({
      action: "create",
      values: valid,
    });
  });
  it("defaults new products inactive without a preset", () => {
    render(<SiteFormDialog mode="create" onClose={vi.fn()} />);
    expect(screen.getByLabelText("수집 활성화")).not.toBeChecked();
  });
  it.each([
    ["ga4_property_id", "G-XXXX", "숫자"],
    ["gsc_property", "example.com", "Search Console"],
    ["bing_site_url", "example.com", "Bing"],
  ])("rejects invalid %s without a request", (key, value, message) => {
    expect(onboardingError({ ...valid, [key]: value })).toContain(message);
  });
  it("detects duplicates but permits editing the same product", () => {
    expect(onboardingError(valid, [site])).toContain("이미 등록된");
    expect(onboardingError(valid, [site], site.id)).toBeNull();
  });
  it("preserves existing status, Active and AdSense mapping on edit", async () => {
    render(
      <SiteFormDialog
        mode="edit"
        site={{ ...site, is_active: true }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("수집 활성화")).toBeChecked();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "변경 저장" }));
    });
    await vi.waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0]).toMatchObject({
      action: "update",
      id: site.id,
      values: {
        status: "LIVE",
        is_active: true,
        adsense_mapping_key: "example.com",
        adsense_enabled: true,
      },
    });
  });
  it("shows server validation errors without closing the form", async () => {
    const close = vi.fn();
    mutate.mockImplementation((_values, callbacks) =>
      callbacks.onError(
        new SaveSiteError("validation", "Server rejected this product", 400),
      ),
    );
    render(<SiteFormDialog mode="create" preset={valid} onClose={close} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "제품 등록" }));
    });
    expect(
      await screen.findByText("Server rejected this product"),
    ).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
  });
});
