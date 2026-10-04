import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { fetchAllPages } from "@/lib/paginate";
import type {
  Idea,
  FactoryWeek,
  AdSenseDaily,
} from "../../../supabase/functions/_shared/product";
export function useIdeas() {
  return useQuery({
    queryKey: ["factory", "ideas"],
    queryFn: () =>
      fetchAllPages<Idea>(() =>
        supabase
          .from("ideas")
          .select("*")
          .order("opportunity_score", { ascending: false })
          .order("id"),
      ),
  });
}
export function useWeeks() {
  return useQuery({
    queryKey: ["factory", "weeks"],
    queryFn: () =>
      fetchAllPages<FactoryWeek>(() =>
        supabase
          .from("factory_weeks")
          .select("*")
          .order("week_start", { ascending: false }),
      ),
  });
}
export function useRevenue(days: number, productId?: string) {
  const since = new Date(Date.now() - days * 86400000)
    .toISOString()
    .slice(0, 10);
  return useQuery({
    queryKey: ["factory", "revenue", days, productId],
    queryFn: () =>
      fetchAllPages<AdSenseDaily>(() => {
        let q = supabase
          .from("adsense_daily_metrics")
          .select("*")
          .gte("metric_date", since)
          .order("metric_date")
          .order("product_id");
        if (productId) q = q.eq("product_id", productId);
        return q;
      }),
  });
}
export function useFactoryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      action: string;
      id?: string;
      values?: unknown;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "manage-factory",
        { body },
      );
      if (error) {
        let message =
          "Could not save. Check your connection and admin session.";
        try {
          const payload = await (
            error as { context?: Response }
          ).context?.json();
          message = payload?.message ?? message;
        } catch {
          /* keep safe fallback */
        }
        throw new Error(message);
      }
      if (!data?.ok) throw new Error("The request was not saved.");
      return data.result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["factory"] }),
  });
}
export function useAnalyticsDetail(siteId: string, days: number) {
  return useQuery({
    queryKey: ["factory", "detail", siteId, days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86400000)
        .toISOString()
        .slice(0, 10);
      const [audience, events, search] = await Promise.all([
        fetchAllPages<
          import("../../../supabase/functions/_shared/product").AnalyticsExtended
        >(() =>
          supabase
            .from("analytics_extended_daily")
            .select("*")
            .eq("site_id", siteId)
            .gte("metric_date", since)
            .order("metric_date"),
        ),
        fetchAllPages<
          import("../../../supabase/functions/_shared/product").EventDaily
        >(() =>
          supabase
            .from("analytics_event_daily")
            .select("*")
            .eq("site_id", siteId)
            .gte("metric_date", since)
            .order("metric_date")
            .order("event_name"),
        ),
        fetchAllPages<
          import("../../../supabase/functions/_shared/product").SearchAudience
        >(() =>
          supabase
            .from("search_audience_daily")
            .select("*")
            .eq("site_id", siteId)
            .gte("metric_date", since)
            .order("metric_date")
            .order("dimension")
            .order("value"),
        ),
      ]);
      return { audience, events, search };
    },
  });
}
