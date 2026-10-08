import { describe, it, expect } from "vitest";
import {
  previewMetadata,
  defaultMetadataSelection,
  selectedMetadataFields,
} from "./product-metadata";
import type { Site } from "@/types/database";

const document = {
  product_code: "P123",
  name: "Example",
  domain: "example.com",
  website_url: "https://example.com",
  status: "SCALE",
  is_active: true,
  analytics: { ga4_property_id: "123" },
  adsense: { enabled: true, verified_site_domain: "example.com" },
};
const read = (value: unknown, sites: Site[] = []) =>
  previewMetadata(JSON.stringify(value), sites);
const site = {
  id: "existing",
  ...document,
  ga4_property_id: "456",
  gsc_property: null,
  bing_site_url: null,
  adsense_enabled: false,
  adsense_mapping_key: "old.example.com",
} as unknown as Site;

describe("metadata preview", () => {
  it("maps documented nested identifiers without copying Status or Active", () => {
    const preview = read(document);
    expect(preview.fields).toMatchObject({
      ga4_property_id: "123",
      adsense_mapping_key: "example.com",
    });
    expect(preview.fields).not.toHaveProperty("status");
    expect(preview.fields).not.toHaveProperty("is_active");
  });
  it("rejects broken JSON, unsupported formats and missing required fields", () => {
    expect(() => previewMetadata("{", [])).toThrow("Invalid JSON");
    expect(() => read([])).toThrow("Unsupported");
    expect(() => read({ name: "Example" })).toThrow("required");
    expect(() =>
      read({ ...document, analytics: { ga4_property_id: "G-123" } }),
    ).toThrow("numeric");
  });
  it("finds existing products and protects existing mapping until explicitly selected", () => {
    const preview = read(document, [site]);
    expect(preview.site?.id).toBe(site.id);
    const selection = defaultMetadataSelection(preview);
    const fields = selectedMetadataFields(preview, selection);
    expect(fields).not.toHaveProperty("adsense_mapping_key");
    expect(fields).not.toHaveProperty("ga4_property_id");
    expect(selectedMetadataFields(preview, [])).toEqual({});
    expect(selectedMetadataFields(preview, ["adsense_mapping_key"])).toEqual({
      adsense_mapping_key: "example.com",
    });
  });
  it("rejects conflicting Registry matches and AdSense ownership", () => {
    expect(() =>
      read(document, [site, { ...site, id: "other", product_code: "P999" }]),
    ).toThrow("different products");
    expect(() =>
      read(document, [
        {
          ...site,
          product_code: "P999",
          domain: "other.com",
          adsense_mapping_key: "example.com",
        },
      ]),
    ).toThrow("another product");
  });
  it("rejects nested secrets and URL credentials without returning secret values", () => {
    expect(() =>
      read({ ...document, extra: { refresh_token: "hidden-sentinel" } }),
    ).toThrow("Remove credentials");
    expect(() =>
      read({ ...document, website_url: "https://user:password@example.com" }),
    ).toThrow("credentials");
    expect(() =>
      read({
        ...document,
        website_url: "https://example.com?token=hidden-sentinel",
      }),
    ).toThrow("query");
    expect(
      read({ ...document, core_action_name: "ignored", extra: "ignored" })
        .fields,
    ).not.toHaveProperty("extra");
  });
  it.each([
    { website_url: "https:example.com?token=hidden-sentinel" },
    { website_url: "https:user:hidden-sentinel@example.com" },
    { website_url: "https:/example.com#hidden-sentinel" },
    { website_url: "ht\ntps://example.com?token=hidden-sentinel" },
    { github_repo: "https:example.com?token=hidden-sentinel" },
    { deploy_url: "https:user:hidden-sentinel@example.com" },
    { analytics: { gsc_property: "https:example.com?token=hidden-sentinel" } },
    { analytics: { bing_site_url: "https:example.com#hidden-sentinel" } },
  ])("rejects credential-bearing URL parser variants: %j", (fields) => {
    let error: unknown;
    try {
      read({ ...document, ...fields });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain(
      "credentials, query parameters or fragments",
    );
    expect((error as Error).message).not.toContain("hidden-sentinel");
  });
  it("preserves credential-free URL variants and non-URL metadata", () => {
    const preview = read({
      ...document,
      website_url: "https:example.com",
      analytics: {
        ga4_property_id: "123",
        gsc_property: "sc-domain:example.com",
      },
    });
    expect(preview.fields).toMatchObject({
      website_url: "https:example.com",
      ga4_property_id: "123",
      gsc_property: "sc-domain:example.com",
    });
  });
});
