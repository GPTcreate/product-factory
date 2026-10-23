import { useRouteError } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function RouteError() {
  const error = useRouteError();
  const moduleFailure =
    error instanceof Error &&
    /dynamically imported module|module script|loading chunk|importing a module/i.test(
      error.message,
    );
  return (
    <main className="mx-auto max-w-lg space-y-4 px-6 py-16" role="alert">
      <h1 className="text-xl font-semibold">
        {moduleFailure
          ? "화면 파일을 불러오지 못했습니다"
          : "화면을 열지 못했습니다"}
      </h1>
      <p>
        {moduleFailure
          ? "새 배포 또는 일시적인 연결 문제일 수 있습니다. 연결을 확인하고 현재 페이지를 새로고침해 주세요."
          : "일시적인 오류가 발생했습니다. 현재 페이지를 새로고침한 뒤 다시 시도해 주세요."}
      </p>
      <p className="text-sm text-muted-foreground">
        저장하지 않은 입력은 새로고침하면 사라집니다.
      </p>
      <Button onClick={() => window.location.reload()}>페이지 새로고침</Button>
    </main>
  );
}
