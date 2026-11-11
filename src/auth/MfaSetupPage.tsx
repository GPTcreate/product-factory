import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/AuthProvider";
import { AuthShell } from "@/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

interface EnrollData {
  factorId: string;
  qrCode: string; // SVG data URL
  secret: string;
}

export function MfaSetupPage() {
  const navigate = useNavigate();
  const { refresh, signOut } = useAuth();
  const [enroll, setEnroll] = useState<EnrollData | null>(null);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const started = useRef(false);

  // Enroll a fresh TOTP factor on mount, clearing any stale unverified ones so
  // repeated visits don't pile up orphan factors.
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        const { data: list } = await supabase.auth.mfa.listFactors();
        const stale = (list?.all ?? []).filter(
          (f) => f.factor_type === "totp" && f.status === "unverified",
        );
        await Promise.all(
          stale.map((f) => supabase.auth.mfa.unenroll({ factorId: f.id })),
        );

        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: `Authenticator ${new Date().toISOString()}`,
        });
        if (error || !data) {
          setEnrollError(
            "2단계 인증 설정을 시작하지 못했습니다. 다시 시도하세요.",
          );
          return;
        }
        setEnroll({
          factorId: data.id,
          qrCode: data.totp.qr_code,
          secret: data.totp.secret,
        });
      } catch {
        setEnrollError(
          "2단계 인증 설정을 시작하지 못했습니다. 다시 시도하세요.",
        );
      }
    })();
  }, []);

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enroll) return;
    setVerifyError(null);

    if (!/^\d{6}$/.test(code)) {
      setVerifyError("인증 앱의 6자리 코드를 입력하세요.");
      return;
    }

    setVerifying(true);
    try {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: enroll.factorId });
      if (challengeError || !challenge) {
        setVerifyError("인증을 시작하지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: enroll.factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyErr) {
        setVerifyError("인증 코드가 일치하지 않습니다. 다시 시도하세요.");
        return;
      }
      await refresh(); // session is now aal2
      navigate("/", { replace: true });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <AuthShell
      title="2단계 인증 설정"
      subtitle="인증 앱으로 QR 코드를 스캔한 뒤 6자리 코드를 입력하세요."
    >
      {enrollError && <Alert tone="error">{enrollError}</Alert>}

      {!enroll && !enrollError && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Spinner /> 인증 정보 준비 중…
        </div>
      )}

      {enroll && (
        <form onSubmit={onVerify} className="space-y-4">
          <div className="flex justify-center">
            <img
              src={enroll.qrCode}
              alt="인증 앱 등록용 QR 코드"
              className="h-44 w-44 rounded-md border border-border bg-white p-2"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="secret">
              스캔할 수 없다면 이 코드를 직접 입력하세요.
            </Label>
            <Input
              id="secret"
              readOnly
              value={enroll.secret}
              onFocus={(e) => e.currentTarget.select()}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="code">6자리 인증 코드</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
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
            인증하고 계속하기
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
