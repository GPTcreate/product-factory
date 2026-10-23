import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { fetchAllPages } from "@/lib/paginate";
import type { AnalyticsDaily, SearchDaily } from "@/types/database";
import type {
  AdSenseDaily,
  EventDaily,
} from "../../../supabase/functions/_shared/product";
import type {
  LaunchCheck,
  ProductTask,
  ReviewGoal,
  ReviewRecord,
} from "../../../supabase/functions/_shared/operations";

export function useProductOperations(siteId: string) {
  return useQuery({
    queryKey: ["product-operations", siteId],
    queryFn: async () => {
      const [checks, tasks, goals, reviews] = await Promise.all([
        fetchAllPages<LaunchCheck>(() =>
          supabase
            .from("product_launch_checks")
            .select("*")
            .eq("site_id", siteId)
            .order("item_key"),
        ),
        fetchAllPages<ProductTask>(() =>
          supabase
            .from("product_tasks")
            .select("*")
            .eq("site_id", siteId)
            .order("updated_at", { ascending: false })
            .order("id"),
        ),
        supabase
          .from("product_review_goals")
          .select("*")
          .eq("site_id", siteId)
          .maybeSingle(),
        supabase
          .from("product_reviews")
          .select("*")
          .eq("site_id", siteId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      if (goals.error) throw goals.error;
      if (reviews.error) throw reviews.error;
      return {
        checks,
        tasks,
        goal: goals.data as ReviewGoal | null,
        reviews: (reviews.data ?? []) as ReviewRecord[],
      };
    },
  });
}
export function useOperationsMutation(siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { action: string; values: unknown }) => {
      const { data, error } = await supabase.functions.invoke(
        "manage-factory",
        { body: input },
      );
      if (error) {
        let message =
          "Could not save. Check your admin session and connection.";
        try {
          const body = await (error as { context?: Response }).context?.json();
          if (typeof body?.message === "string") message = body.message;
        } catch {
          /* safe fallback */
        }
        throw new Error(message);
      }
      if (!data?.ok) throw new Error("Changes were not saved.");
      return data.result;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["product-operations", siteId] }),
  });
}

export function useOperationsMetrics(
  siteId: string,
  start: string,
  end: string,
) {
  return useQuery({
    queryKey: ["factory", "operations-metrics", siteId, start, end],
    queryFn: async () => {
      const [analytics, search, revenue, events] = await Promise.all([
        fetchAllPages<AnalyticsDaily>(() =>
          supabase
            .from("analytics_daily")
            .select("*")
            .eq("site_id", siteId)
            .gte("metric_date", start)
            .lte("metric_date", end)
            .order("metric_date"),
        ),
        fetchAllPages<SearchDaily>(() =>
          supabase
            .from("search_daily")
            .select("*")
            .eq("site_id", siteId)
            .gte("metric_date", start)
            .lte("metric_date", end)
            .order("metric_date")
            .order("engine"),
        ),
        fetchAllPages<AdSenseDaily>(() =>
          supabase
            .from("adsense_daily_metrics")
            .select("*")
            .eq("product_id", siteId)
            .gte("metric_date", start)
            .lte("metric_date", end)
            .order("metric_date"),
        ),
        fetchAllPages<EventDaily>(() =>
          supabase
            .from("analytics_event_daily")
            .select("*")
            .eq("site_id", siteId)
            .eq("event_name", "core_action")
            .gte("metric_date", start)
            .lte("metric_date", end)
            .order("metric_date"),
        ),
      ]);
      return { analytics, search, revenue, events };
    },
    enabled: start <= end,
  });
}
