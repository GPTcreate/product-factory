import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/AuthProvider";
import { AuthShell } from "@/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

export function MfaChallengePage() {
  const navigate = useNavigate();
  const { refresh, signOut } = useAuth();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        setLoadError("인증 앱 정보를 불러오지 못했습니다. 다시 로그인하세요.");
        return;
      }
      const verified = (data?.totp ?? []).find((f) => f.status === "verified");
      if (!verified) {
        // No verified factor - enrollment is the right place.
        navigate("/mfa/setup", { replace: true });
        return;
      }
      setFactorId(verified.id);
    })();
  }, [navigate]);

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setVerifyError(null);

    if (!/^\d{6}$/.test(code)) {
      setVerifyError("인증 앱의 6자리 코드를 입력하세요.");
      return;
    }

    setVerifying(true);
    try {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });
      if (challengeError || !challenge) {
        setVerifyError("인증을 시작하지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyErr) {
        setVerifyError(
          "인증 코드가 일치하지 않거나 만료되었습니다. 다시 시도하세요.",
        );
        return;
      }
      await refresh(); // session is now aal2
      navigate("/", { replace: true });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <AuthShell title="2단계 인증" subtitle="인증 앱의 6자리 코드를 입력하세요.">
      {loadError && <Alert tone="error">{loadError}</Alert>}

      {!factorId && !loadError && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Spinner /> 불러오는 중…
        </div>
      )}

      {factorId && (
        <form onSubmit={onVerify} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="code">6자리 인증 코드</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              aria-invalid={!!verifyError}
            />
            {verifyError && (
              <p className="text-xs text-critical">{verifyError}</p>
            )}
          </div>

          <Button type="submit" className="w-full" loading={verifying}>
            인증하기
          </Button>
        </form>
      )}

      <div className="mt-4 text-center text-sm">
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          로그아웃
        </button>
      </div>
    </AuthShell>
  );
}
