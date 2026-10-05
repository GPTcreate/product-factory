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

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/valid email address/i)).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("has no sign-up link", () => {
    renderLogin();
    expect(screen.queryByText(/sign up/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/create account/i)).not.toBeInTheDocument();
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
      await user.type(screen.getByLabelText("Email"), "test@example.com");
      await user.type(screen.getByLabelText("Password"), "fixture-password");
      await user.click(screen.getByRole("button", { name: /sign in/i }));
      expect(
        await screen.findByText(/Could not reach the sign-in service/),
      ).toBeInTheDocument();
      expect(screen.queryByText("Invalid email or password.")).toBeNull();
      expect(screen.getByRole("button", { name: /sign in/i })).toBeEnabled();
      expect(warn).toHaveBeenCalledWith("Sign-in failed", {
        category: "network",
        status: 0,
        code: undefined,
      });
    },
  );
});
