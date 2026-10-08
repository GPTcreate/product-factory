import { z } from "zod";
import type { Site } from "@/types/database";
import type { SiteFormValues } from "./api";
import { onboardingError } from "./site-onboarding";
import {
  MARKETS,
  PRODUCT_STATUSES,
} from "../../supabase/functions/_shared/product";

const text = z.string().max(2048);
const optionalText = text.nullable().optional();
const schema = z.object({
  product_code: text.min(1),
  name: text.min(1),
  domain: text.min(1),
  website_url: text.url(),
  market: z.enum(MARKETS).optional(),
  primary_language: text.optional(),
  level: z.number().int().min(1).max(3).optional(),
  version: text.optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
  is_active: z.boolean().optional(),
  launch_date: optionalText,
  github_repo: optionalText,
  deploy_url: optionalText,
  analytics: z
    .object({
      ga4_property_id: optionalText,
      gsc_property: optionalText,
      bing_site_url: optionalText,
      ga4_measurement_id: optionalText,
    })
    .optional(),
  adsense: z
    .object({
      enabled: z.boolean().optional(),
      verified_site_domain: optionalText,
    })
    .optional(),
});

function containsSecret(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, entry]) =>
      /secret|token|password|credential|api.?key|private.?key|authorization/i.test(
        key,
      ) || containsSecret(entry),
  );
}

export interface MetadataPreview {
  site?: Site;
  fields: Partial<SiteFormValues>;
  ignored: string[];
}

/** Never return input text, parser exceptions, or secret values to the UI. */
export function previewMetadata(
  raw: string,
  products: Site[],
): MetadataPreview {
  if (raw.length > 128 * 1024)
    throw new Error("Metadata must be at most 128 KB.");
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON. Check the file syntax.");
  }
  if (containsSecret(input))
    throw new Error("Remove credentials and secrets from the metadata file.");
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new Error(
      "Unsupported metadata format or missing/invalid required fields: product_code, name, domain, website_url.",
    );
  const data = parsed.data;
  const matches = products.filter(
    (p) =>
      p.product_code?.toUpperCase() ===
        data.product_code.trim().toUpperCase() ||
      p.domain.toLowerCase() === data.domain.trim().toLowerCase(),
  );
  if (matches.length > 1)
    throw new Error(
      "Product code and domain match different products. Resolve the Registry conflict first.",
    );
  const site = matches[0];
  const fields: Partial<SiteFormValues> = {
    product_code: data.product_code,
    name: data.name,
    domain: data.domain,
    website_url: data.website_url,
  };
  for (const key of [
    "market",
    "primary_language",
    "level",
    "version",
    "launch_date",
    "github_repo",
    "deploy_url",
  ] as const) {
    if (data[key] !== undefined && data[key] !== null)
      Object.assign(fields, { [key]: data[key] });
  }
  for (const key of [
    "ga4_property_id",
    "gsc_property",
    "bing_site_url",
  ] as const) {
    if (data.analytics?.[key] != null) fields[key] = data.analytics[key];
  }
  if (data.adsense?.enabled !== undefined)
    fields.adsense_enabled = data.adsense.enabled;
  if (data.adsense?.verified_site_domain != null)
    fields.adsense_mapping_key = data.adsense.verified_site_domain;
  // URL credentials and sensitive query values must never enter the preview.
  for (const value of Object.values(fields)) {
    if (typeof value !== "string") continue;
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      if (/https?:\/\//i.test(value))
        throw new Error("Invalid URL in metadata.");
      continue;
    }
    if (url.username || url.password || url.search || url.hash)
      throw new Error(
        "Metadata URLs must not contain credentials, query parameters or fragments.",
      );
  }
  const candidate: SiteFormValues = {
    ...site,
    name: site?.name ?? "",
    domain: site?.domain ?? "",
    website_url: site?.website_url ?? "",
    ga4_property_id: site?.ga4_property_id ?? "",
    gsc_property: site?.gsc_property ?? "",
    bing_site_url: site?.bing_site_url ?? "",
    is_active: site?.is_active ?? false,
    ...fields,
  };
  const error = onboardingError(candidate, products, site?.id);
  if (error) throw new Error(error);
  const ignored = [
    "Status and Active are preserved; new products remain inactive.",
    "core_action_name and GA4 measurement ID are documentation only.",
    "Unknown fields are ignored; only the listed Registry fields can be applied.",
  ];
  return { site, fields, ignored };
}

export function defaultMetadataSelection(preview: MetadataPreview): string[] {
  return Object.keys(preview.fields).filter(
    (key) =>
      !preview.site ||
      ![
        "ga4_property_id",
        "gsc_property",
        "bing_site_url",
        "adsense_enabled",
        "adsense_mapping_key",
      ].includes(key),
  );
}

export function selectedMetadataFields(
  preview: MetadataPreview,
  selected: string[],
): Partial<SiteFormValues> {
  return Object.fromEntries(
    Object.entries(preview.fields).filter(([key]) => selected.includes(key)),
  );
}
