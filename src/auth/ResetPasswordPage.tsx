import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { env } from "@/lib/env";
import { AuthShell } from "@/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  // 'request' - ask for the reset email; 'update' - set a new password after
  // arriving from the recovery link.
  const [mode, setMode] = useState<"request" | "update">("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("update");
    });
    return () => subscription.unsubscribe();
  }, []);

  const onRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("올바른 이메일 주소를 입력하세요.");
      return;
    }
    setBusy(true);
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${env.VITE_APP_URL}/reset-password`,
      });
      // Generic confirmation - never reveal whether the email exists.
      setNotice(
        "등록된 계정의 이메일이라면 비밀번호 재설정 링크를 보내드립니다.",
      );
    } finally {
      setBusy(false);
    }
  };

  const onUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("비밀번호는 8자 이상으로 입력하세요.");
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) {
        setError(
          "비밀번호를 변경하지 못했습니다. 링크가 만료되었을 수 있습니다.",
        );
        return;
      }
      navigate("/", { replace: true });
    } finally {
      setBusy(false);
    }
  };

  if (mode === "update") {
    return (
      <AuthShell title="새 비밀번호 설정">
        <form onSubmit={onUpdate} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <div className="space-y-1.5">
            <Label htmlFor="new-password">새 비밀번호</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" loading={busy}>
            비밀번호 변경
          </Button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="비밀번호 재설정"
      subtitle="새 비밀번호를 설정할 링크를 이메일로 보내드립니다."
    >
      <form onSubmit={onRequest} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
        <div className="space-y-1.5">
          <Label htmlFor="email">이메일</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" loading={busy}>
          재설정 링크 보내기
        </Button>
        <div className="text-center text-sm">
          <Link
            to="/login"
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            로그인으로 돌아가기
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
