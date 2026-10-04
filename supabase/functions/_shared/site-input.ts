import { MARKETS, PRODUCT_STATUSES, type ProductFields } from "./product.ts";
import { validDate } from "./factory-input.ts";
// Pure validation for the add/edit-site form - no Deno/npm imports, so it is
// unit-testable and shared by the edge function.
import type { ParseResult } from "./validate.ts";

export interface SiteInput extends Partial<ProductFields> {
  name: string;
  domain: string;
  website_url: string;
  gsc_property: string | null;
  ga4_property_id: string | null;
  bing_site_url: string | null;
  is_active: boolean;
}

const DOMAIN_RE = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optional(value: unknown): string | null {
  const s = str(value);
  return s.length > 0 ? s : null;
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function parseSiteInput(body: unknown): ParseResult<SiteInput> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object" };
  }
  const b = body as Record<string, unknown>;

  const name = str(b.name);
  if (name.length < 1 || name.length > 120) {
    return { ok: false, error: "Name is required (max 120 characters)" };
  }

  const domain = str(b.domain).toLowerCase();
  if (!DOMAIN_RE.test(domain)) {
    return { ok: false, error: "Enter a valid domain, e.g. example.com" };
  }

  const website_url = str(b.website_url);
  if (!isHttpUrl(website_url)) {
    return {
      ok: false,
      error: "Website URL must start with http:// or https://",
    };
  }

  const product: Partial<ProductFields> = {};
  if (b.product_code !== undefined) {
    const code = str(b.product_code).toUpperCase();
    if (code && !/^P[0-9]{3,6}$/.test(code))
      return { ok: false, error: "Product code must be P001–P999999" };
    product.product_code = code || null;
  }
  if (b.market !== undefined) {
    if (!(MARKETS as readonly unknown[]).includes(b.market))
      return { ok: false, error: "Invalid market" };
    product.market = b.market as ProductFields["market"];
  }
  if (b.status !== undefined) {
    if (!(PRODUCT_STATUSES as readonly unknown[]).includes(b.status))
      return { ok: false, error: "Invalid status" };
    product.status = b.status as ProductFields["status"];
  }
  if (b.level !== undefined) {
    if (![1, 2, 3].includes(Number(b.level)))
      return { ok: false, error: "Level must be 1, 2 or 3" };
    product.level = Number(b.level);
  }
  for (const key of ["primary_language", "version"] as const)
    if (b[key] !== undefined) {
      if (!str(b[key]) || str(b[key]).length > 40)
        return { ok: false, error: `Invalid ${key}` };
      product[key] = str(b[key]);
    }
  for (const key of ["github_repo", "deploy_url"] as const)
    if (b[key] !== undefined) {
      const value = optional(b[key]);
      if (value && (!isHttpUrl(value) || value.length > 2048))
        return { ok: false, error: `Invalid ${key} URL` };
      product[key] = value;
    }
  if (b.launch_date !== undefined) {
    const date = optional(b.launch_date);
    if (date && !validDate(date))
      return { ok: false, error: "Invalid launch date" };
    product.launch_date = date;
  }
  if (b.adsense_mapping_key !== undefined) {
    const key = optional(b.adsense_mapping_key)?.toLowerCase() ?? null;
    if (key && !DOMAIN_RE.test(key))
      return {
        ok: false,
        error: "AdSense mapping must be an exact verified site domain",
      };
    product.adsense_mapping_key = key;
  }
  if (b.adsense_enabled !== undefined) {
    if (typeof b.adsense_enabled !== "boolean")
      return { ok: false, error: "Invalid AdSense enabled flag" };
    if (b.adsense_enabled && !product.adsense_mapping_key)
      return { ok: false, error: "AdSense requires its verified site domain" };
    product.adsense_enabled = b.adsense_enabled;
  }
  return {
    ok: true,
    value: {
      ...product,
      name,
      domain,
      website_url,
      gsc_property: optional(b.gsc_property),
      ga4_property_id: optional(b.ga4_property_id),
      bing_site_url: optional(b.bing_site_url),
      is_active: b.is_active === undefined ? true : Boolean(b.is_active),
    },
  };
}
