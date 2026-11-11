import { useCallback, useEffect, useState } from "react";
import type { Factor } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export function SecuritySettingsPage() {
  const { user, currentLevel, signOut, refresh } = useAuth();
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const loadFactors = useCallback(async () => {
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setError("인증 앱 정보를 불러오지 못했습니다.");
      return;
    }
    setFactors(data?.all ?? []);
  }, []);

  useEffect(() => {
    void loadFactors();
  }, [loadFactors]);

  const onRemove = async (factorId: string) => {
    setError(null);
    const { error: unErr } = await supabase.auth.mfa.unenroll({ factorId });
    if (unErr) {
      setError("인증 앱을 삭제하지 못했습니다.");
      return;
    }
    setConfirmRemove(null);
    await loadFactors();
    await refresh();
  };

  const verifiedCount =
    factors?.filter((f) => f.status === "verified").length ?? 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">보안</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          계정과 2단계 인증을 관리합니다.
        </p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>계정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="이메일" value={user?.email ?? "-"} />
          <Row
            label="인증 수준"
            value={
              currentLevel === "aal2"
                ? "2단계 인증 완료 (aal2)"
                : (currentLevel ?? "-")
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>인증 앱</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {factors === null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner /> 불러오는 중…
            </div>
          ) : factors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              등록된 인증 앱이 없습니다.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {factors.map((factor) => (
                <li
                  key={factor.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {factor.friendly_name || "인증 앱"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {factor.factor_type.toUpperCase()} ·{" "}
                      {factor.status === "verified" ? "인증 완료" : "인증 전"}
                    </p>
                  </div>
                  {confirmRemove === factor.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {verifiedCount <= 1
                          ? "마지막 인증 수단입니다. 삭제하면 다시 등록해야 합니다."
                          : "삭제할까요?"}
                      </span>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => void onRemove(factor.id)}
                      >
                        확인
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmRemove(null)}
                      >
                        취소
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setConfirmRemove(factor.id)}
                    >
                      삭제
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <AddAuthenticator onAdded={loadFactors} />
        </CardContent>
      </Card>

      <Button variant="secondary" onClick={() => void signOut()}>
        로그아웃
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

interface Enroll {
  factorId: string;
  qrCode: string;
  secret: string;
}

function AddAuthenticator({ onAdded }: { onAdded: () => Promise<void> }) {
  const [enroll, setEnroll] = useState<Enroll | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    setBusy(true);
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Authenticator ${new Date().toISOString()}`,
      });
      if (enrollError || !data) {
        setError("인증 앱 등록을 시작하지 못했습니다.");
        return;
      }
      setEnroll({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enroll) return;
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError("6자리 인증 코드를 입력하세요.");
      return;
    }
    setBusy(true);
    try {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: enroll.factorId });
      if (challengeError || !challenge) {
        setError("인증을 시작하지 못했습니다.");
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enroll.factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) {
        setError("인증 코드가 일치하지 않습니다. 다시 시도하세요.");
        return;
      }
      setEnroll(null);
      setCode("");
      await onAdded();
    } finally {
      setBusy(false);
    }
  };

  if (!enroll) {
    return (
      <Button size="sm" variant="secondary" loading={busy} onClick={start}>
        인증 앱 추가
      </Button>
    );
  }

  return (
    <form
      onSubmit={verify}
      className="space-y-3 rounded-md border border-border p-3"
    >
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex justify-center">
        <img
          src={enroll.qrCode}
          alt="인증 앱 등록용 QR 코드"
          className="h-40 w-40 rounded-md border border-border bg-white p-2"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="add-secret">직접 입력용 코드</Label>
        <Input
          id="add-secret"
          readOnly
          value={enroll.secret}
          onFocus={(e) => e.currentTarget.select()}
          className="font-mono text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="add-code">6자리 인증 코드</Label>
        <Input
          id="add-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" type="submit" loading={busy}>
          인증하기
        </Button>
        <Button
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => {
            setEnroll(null);
            setCode("");
          }}
        >
          취소
        </Button>
      </div>
    </form>
  );
}
