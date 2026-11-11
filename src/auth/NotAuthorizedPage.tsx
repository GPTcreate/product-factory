import { useAuth } from "@/auth/AuthProvider";
import { AuthShell } from "@/auth/AuthShell";
import { Button } from "@/components/ui/button";

/**
 * Shown when a fully authenticated, MFA-verified user is not in the admin
 * allowlist. They have a valid session but no access to portfolio data.
 */
export function NotAuthorizedPage() {
  const { user, signOut } = useAuth();
  return (
    <AuthShell title="접근 권한이 없습니다">
      <p className="text-sm text-muted-foreground">
        계정 <span className="font-medium text-foreground">{user?.email}</span>
        은(는) 로그인과 2단계 인증을 완료했지만 이 포트폴리오를 볼 권한이
        없습니다. 권한이 필요하면 포트폴리오 관리자에게 문의하세요.
      </p>
      <div className="mt-4">
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => void signOut()}
        >
          로그아웃
        </Button>
      </div>
    </AuthShell>
  );
}
