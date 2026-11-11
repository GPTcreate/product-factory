import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "@/auth/LoginPage";

// Spy on the sign-in call so we can assert it is NOT reached on invalid input.
const signIn = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { signInWithPassword: signIn } },
}));

function renderLogin() {
  return render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <LoginPage />
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => signIn.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("shows a validation error and does not call Supabase on empty submit", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { name: /로그인/ }));

    expect(await screen.findByText(/올바른 이메일 주소/)).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("has no sign-up link", () => {
    renderLogin();
    expect(screen.queryByText(/회원가입/)).not.toBeInTheDocument();
    expect(screen.queryByText(/계정 만들기/)).not.toBeInTheDocument();
  });

  it.each(["returned", "thrown"])(
    "does not report a %s network failure as incorrect credentials",
    async (mode) => {
      const error = { name: "AuthRetryableFetchError", status: 0 };
      if (mode === "returned") signIn.mockResolvedValue({ error });
      else signIn.mockRejectedValue(error);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const user = userEvent.setup();
      renderLogin();
      await user.type(screen.getByLabelText("이메일"), "test@example.com");
      await user.type(screen.getByLabelText("비밀번호"), "fixture-password");
      await user.click(screen.getByRole("button", { name: /로그인/ }));
      expect(
        await screen.findByText(/로그인 서비스에 연결하지 못했습니다/),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("이메일 또는 비밀번호가 올바르지 않습니다."),
      ).toBeNull();
      expect(screen.getByRole("button", { name: /로그인/ })).toBeEnabled();
      expect(warn).toHaveBeenCalledWith("Sign-in failed", {
        category: "network",
        status: 0,
        code: undefined,
      });
    },
  );
});
