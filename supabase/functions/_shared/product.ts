// Shared product contract. No runtime dependencies: used by browser and Edge.
export const PRODUCT_STATUSES = [
  "IDEA",
  "SPEC",
  "BUILD",
  "LIVE",
  "HOLD",
  "KILL",
  "SCALE",
] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export const MARKETS = ["Korea", "English", "Global"] as const;
export interface ProductFields {
  product_code: string | null;
  market: (typeof MARKETS)[number];
  primary_language: string;
  level: number;
  version: string;
  status: ProductStatus;
  launch_date: string | null;
  github_repo: string | null;
  deploy_url: string | null;
  adsense_enabled: boolean;
  adsense_mapping_key: string | null;
}
export const SCORE_WEIGHTS = {
  utility: 20,
  organic: 20,
  repeat: 20,
  advertising: 10,
  premium: 10,
  differentiation: 10,
  automation: 5,
  one_week: 5,
} as const;
export type Scores = Record<keyof typeof SCORE_WEIGHTS, number>;
export const EMPTY_SCORES: Scores = {
  utility: 0,
  organic: 0,
  repeat: 0,
  advertising: 0,
  premium: 0,
  differentiation: 0,
  automation: 0,
  one_week: 0,
};
export function opportunityScore(scores: Scores): number {
  return Math.round(
    Object.entries(SCORE_WEIGHTS).reduce((sum, [key, weight]) => {
      const rating = scores[key as keyof Scores];
      if (!Number.isInteger(rating) || rating < 0 || rating > 5)
        throw new Error("Scores must be integers between 0 and 5");
      return sum + (rating / 5) * weight;
    }, 0),
  );
}
export interface Idea {
  id: string;
  title: string;
  problem: string;
  target_user: string;
  market: string;
  primary_language: string;
  acquisition_channel: string;
  repeat_usage_potential: string;
  ad_potential: string;
  premium_potential: string;
  competition: string;
  build_difficulty: string;
  maintenance_risk: string;
  level_candidate: number;
  scores: Scores;
  opportunity_score: number;
  evidence: string;
  notes: string;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}
export interface FactoryWeek {
  week_start: string;
  product_id: string | null;
  notes: string;
  hypothesis: string;
  success_metric: string;
  result: string;
  decision: string;
  updated_at: string;
}
export interface AdSenseDaily {
  product_id: string;
  metric_date: string;
  currency_code: string;
  estimated_earnings: number;
  impressions: number;
  page_views: number;
  ad_requests: number;
  matched_ad_requests: number;
  clicks: number;
  ctr: number | null;
  rpm: number | null;
  coverage: number | null;
  mapping_key: string;
  synced_at: string;
}
export interface AnalyticsExtended {
  site_id: string;
  metric_date: string;
  new_users: number;
  returning_users: number;
  engagement_seconds: number;
  updated_at: string;
}
export interface EventDaily {
  site_id: string;
  metric_date: string;
  event_name: string;
  event_count: number;
  updated_at: string;
}
export interface SearchAudience {
  site_id: string;
  metric_date: string;
  dimension: "country" | "device";
  value: string;
  clicks: number;
  impressions: number;
  ctr: number | null;
  average_position: number | null;
  updated_at: string;
}
