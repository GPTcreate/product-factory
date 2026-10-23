import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useSites } from "@/lib/hooks";
import { usePrivacyMode } from "@/lib/privacy";
import { Button } from "@/components/ui/button";

export function OperationalAlerts() {
  const privacy = usePrivacyMode();
  const sites = useSites();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["operational-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operational_alerts")
        .select("*")
        .is("resolved_at", null)
        .order("last_seen_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
  const ack = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke(
        "manage-factory",
        { body: { action: "alert.ack", id } },
      );
      if (error || !data?.ok)
        throw new Error("Alert acknowledgement was not saved.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operational-alerts"] }),
  });
  if (privacy.enabled)
    return (
      <section className="factory-panel">
        Operational alerts hidden in privacy mode.
      </section>
    );
  return (
    <section className="factory-panel space-y-3">
      <h2 className="font-semibold">예약 운영 알림</h2>
      <p className="text-sm text-muted-foreground">
        DB 모니터가 매시 5분에 실패·부분 수집·장기 실행·지연을 확인합니다. 확인
        처리는 원인을 해결하지 않습니다. 외부 메시지는 발송하지 않습니다. DB
        자체가 정지되면 이 모니터도 실행되지 않습니다.
      </p>
      {query.isLoading && <p>Loading alerts…</p>}
      {query.isError && (
        <p role="alert">
          알림을 읽지 못했습니다.{" "}
          <Button onClick={() => void query.refetch()}>Retry alerts</Button>
        </p>
      )}
      {query.data?.length === 0 && (
        <p>
          현재 저장된 미해결 알림이 없습니다. 전체 공급자의 운영 성공을
          의미하지는 않습니다.
        </p>
      )}
      {query.data?.map((alert) => (
        <article key={alert.id} className="rounded-lg border p-3 space-y-2">
          <Link
            className="text-primary underline"
            to={`/products/${alert.site_id}`}
          >
            {sites.data?.find((s) => s.id === alert.site_id)?.name ?? "Product"}{" "}
            · {alert.source} · {alert.severity}
          </Link>
          <p className="text-sm">{alert.message}</p>
          <p className="text-xs">최근 확인 {alert.last_seen_at}</p>
          {alert.acknowledged_at ? (
            <p className="text-xs">운영자 확인 {alert.acknowledged_at}</p>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              loading={ack.isPending}
              onClick={() => ack.mutate(alert.id)}
            >
              Acknowledge alert
            </Button>
          )}
        </article>
      ))}
      {ack.isError && <p role="alert">{ack.error.message}</p>}
    </section>
  );
}
