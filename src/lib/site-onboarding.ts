import { parseSiteInput } from "../../supabase/functions/_shared/site-input";
import type { SiteFormValues } from "./api";
import type { Site } from "@/types/database";

function httpUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function providerInputError(
  values: Pick<
    SiteFormValues,
    "ga4_property_id" | "gsc_property" | "bing_site_url"
  >,
): string | null {
  if (
    values.ga4_property_id.trim() &&
    !/^\d+$/.test(values.ga4_property_id.trim())
  )
    return "GA4 property ID must be numeric; G- measurement IDs are used by the product tag.";
  const gsc = values.gsc_property.trim();
  if (
    gsc &&
    !(gsc.startsWith("sc-domain:")
      ? /^sc-domain:([a-z0-9-]+\.)+[a-z]{2,}$/i.test(gsc)
      : httpUrl(gsc))
  )
    return "GSC property must be sc-domain:example.com or a full HTTP(S) URL-prefix.";
  if (values.bing_site_url.trim() && !httpUrl(values.bing_site_url.trim()))
    return "Bing site URL must be a full HTTP(S) URL.";
  return null;
}

export function onboardingError(
  values: SiteFormValues,
  products: Site[] = [],
  editingId?: string,
): string | null {
  const parsed = parseSiteInput(values);
  if (!parsed.ok) return parsed.error;
  const providerError = providerInputError(values);
  if (providerError) return providerError;
  for (const product of products) {
    if (product.id === editingId) continue;
    if (
      (values.product_code &&
        product.product_code?.toUpperCase() ===
          values.product_code.trim().toUpperCase()) ||
      product.domain.toLowerCase() === values.domain.trim().toLowerCase()
    )
      return "This product code or domain is already registered. Open the existing product to edit it.";
    if (
      values.adsense_mapping_key &&
      product.adsense_mapping_key?.toLowerCase() ===
        values.adsense_mapping_key.trim().toLowerCase()
    )
      return "This AdSense domain already belongs to another product.";
  }
  return null;
}
