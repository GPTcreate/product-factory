import { render, screen, cleanup } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteError } from "./RouteError";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("route recovery", () => {
  it.each([
    [
      "Failed to fetch dynamically imported module: https://example.test/assets/old.js",
      "화면 파일을 불러오지 못했습니다",
    ],
    ["sensitive internal diagnostic", "화면을 열지 못했습니다"],
  ])(
    "offers recovery without exposing the original error: %s",
    async (message, title) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const router = createMemoryRouter(
        [
          {
            id: "root",
            path: "/",
            element: <p>Loaded</p>,
            errorElement: <RouteError />,
          },
        ],
        {
          hydrationData: { errors: { root: new Error(message) } },
        },
      );
      render(<RouterProvider router={router} />);
      expect(await screen.findByRole("heading", { name: title })).toBeVisible();
      expect(
        screen.getByRole("button", { name: "페이지 새로고침" }),
      ).toBeEnabled();
      expect(screen.queryByText(message)).not.toBeInTheDocument();
      expect(screen.getByText(/저장하지 않은 입력/)).toBeVisible();
      router.dispose();
    },
  );
});
