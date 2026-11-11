import { parseSiteInput } from "../../supabase/functions/_shared/site-input";
import type { SiteFormValues } from "./api";
import type { Site } from "@/types/database";
import { readableError } from "./ui-errors";

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
    return "GA4 속성 ID에는 숫자를 입력하세요. G-로 시작하는 측정 ID는 제품의 방문 태그에 사용합니다.";
  const gsc = values.gsc_property.trim();
  if (
    gsc &&
    !(gsc.startsWith("sc-domain:")
      ? /^sc-domain:([a-z0-9-]+\.)+[a-z]{2,}$/i.test(gsc)
      : httpUrl(gsc))
  )
    return "Search Console 속성에는 sc-domain:example.com 또는 전체 HTTP(S) 주소 접두어를 입력하세요.";
  if (values.bing_site_url.trim() && !httpUrl(values.bing_site_url.trim()))
    return "Bing 사이트 주소에는 전체 HTTP(S) 주소를 입력하세요.";
  return null;
}

export function onboardingError(
  values: SiteFormValues,
  products: Site[] = [],
  editingId?: string,
): string | null {
  const parsed = parseSiteInput(values);
  if (!parsed.ok)
    return readableError(parsed.error, "제품 입력 내용을 확인해 주세요.");
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
      return "이미 등록된 제품 코드 또는 도메인입니다. 기존 제품을 열어 수정하세요.";
    if (
      values.adsense_mapping_key &&
      product.adsense_mapping_key?.toLowerCase() ===
        values.adsense_mapping_key.trim().toLowerCase()
    )
      return "이 AdSense 도메인은 다른 제품에 이미 연결되어 있습니다.";
  }
  return null;
}
