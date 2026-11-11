import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usePrivacyMode } from "@/lib/privacy";
import { readableError } from "@/lib/ui-errors";
import { Button } from "@/components/ui/button";

const RUNTIME_LABELS: Record<string, string> = {
  GOOGLE_CLIENT_ID: "Google 앱 식별 정보",
  GOOGLE_CLIENT_SECRET: "Google 앱 인증 정보",
  GOOGLE_REFRESH_TOKEN: "Google 연결 갱신 인증",
  BING_WEBMASTER_API_KEY: "Bing Webmaster 인증 정보",
  AUTOMATION_SECRET: "예약 자동화 인증",
  ADSENSE_ACCOUNT: "AdSense 계정 연결",
};

async function runtimeRequest(action: string) {
  const { data, error } = await supabase.functions.invoke("manage-factory", {
    body: { action },
  });
  if (error) {
    let message =
      "운영 설정 진단에 실패했습니다. 관리자 권한·2단계 인증·서버 함수 배포를 확인하세요.";
    try {
      const payload = await (error as { context?: Response }).context?.json();
      if (payload?.message) message = readableError(payload, message);
    } catch {
      /* retain safe fallback */
    }
    throw new Error(message);
  }
  if (!data?.ok) throw new Error("운영 설정을 확인하지 못했습니다.");
  return data.result;
}
export function RuntimeConfiguration() {
  const privacy = usePrivacyMode();
  const qc = useQueryClient();
  const query = useQuery<Record<string, boolean>>({
    queryKey: ["factory-runtime-config"],
    queryFn: () => runtimeRequest("system.inspect"),
    retry: false,
  });
  const prepare = useMutation({
    mutationFn: () => runtimeRequest("automation.prepare"),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["factory-runtime-config"] }),
  });
  if (privacy.enabled)
    return (
      <section className="factory-panel">
        데이터 숨김 모드에서는 운영 설정을 표시하지 않습니다.
      </section>
    );
  return (
    <section className="factory-panel space-y-3">
      <h2 className="font-semibold">운영 연결 설정 진단</h2>
      <p className="text-sm text-muted-foreground">
        서버 설정의 존재 여부만 확인합니다. 값과 외부 API 권한은 표시하지
        않으며, 설정됨이 실제 수집 성공을 뜻하지 않습니다.
      </p>
      {query.isLoading && <p>운영 설정 확인 중…</p>}
      {query.isError && (
        <p role="alert">
          {query.error.message}{" "}
          <Button onClick={() => void query.refetch()}>
            운영 설정 다시 확인
          </Button>
        </p>
      )}
      {query.data && (
        <ul className="space-y-1 text-sm">
          {Object.entries(query.data).map(([name, present]) => (
            <li key={name}>
              <span title={name}>{RUNTIME_LABELS[name] ?? name}</span>:{" "}
              {present ? "설정됨" : "미설정"}
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm">
        예약 수집 준비는 기존 서버 함수의 자동화 인증을 비어 있는 Vault
        보관함에만 연결합니다. 기존 값이 다르면 덮어쓰지 않고 중단합니다.
      </p>
      <Button
        variant="secondary"
        disabled={!query.data?.AUTOMATION_SECRET}
        loading={prepare.isPending}
        onClick={() => prepare.mutate()}
      >
        기존 자동화 인증 연결 준비
      </Button>
      {prepare.isError && <p role="alert">{prepare.error.message}</p>}
      {prepare.isSuccess && (
        <p role="status">
          기존 자동화 인증의 Vault 연결을 확인했습니다. 실제 예약 작업과 수집
          성공은 별도로 검증하세요.
        </p>
      )}
    </section>
  );
}
