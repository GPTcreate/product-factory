import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { SiteWithStatuses } from "@/lib/api";
import { ProductOperations } from "./ProductOperations";

const state = vi.hoisted(() => ({
  calls: [] as Array<{
    hookSiteId: string;
    action: string;
    values: { site_id: string; title?: string };
  }>,
}));

vi.mock("./operations-api", async () => {
  const { useCallback, useState } = await import("react");
  return {
    useProductOperations: () => ({
      isLoading: false,
      isError: false,
      data: { checks: [], tasks: [], goal: null, reviews: [] },
    }),
    useOperationsMutation: (hookSiteId: string) => {
      const [isSuccess, setSuccess] = useState(false);
      const reset = useCallback(() => setSuccess(false), []);
      const mutate = useCallback(
        (
          input: {
            action: string;
            values: { site_id: string; title?: string };
          },
          options?: { onSuccess?: () => void },
        ) => {
          state.calls.push({ hookSiteId, ...structuredClone(input) });
          setSuccess(true);
          options?.onSuccess?.();
        },
        [hookSiteId],
      );
      return {
        isPending: false,
        isError: false,
        isSuccess,
        error: null,
        mutate,
        reset,
      };
    },
  };
});

vi.mock("./api", () => ({
  useAnalyticsDetail: () => ({ data: null, isLoading: false, isError: false }),
  useRevenue: () => ({ data: null, isLoading: false, isError: false }),
}));
vi.mock("@/lib/hooks", () => ({
  useSiteMetrics: () => ({ data: null, isLoading: false, isError: false }),
}));
vi.mock("@/lib/privacy", () => ({
  usePrivacyMode: () => ({ enabled: false }),
}));

const product = (id: string, name: string) =>
  ({ id, name, statuses: [] }) as unknown as SiteWithStatuses;

const firstProduct = product(
  "11111111-1111-4111-8111-111111111111",
  "첫 번째 제품",
);
const secondProduct = product(
  "22222222-2222-4222-8222-222222222222",
  "두 번째 제품",
);

function view(site: SiteWithStatuses) {
  return (
    <MemoryRouter>
      <ProductOperations site={site} section="Work" />
    </MemoryRouter>
  );
}

function newTaskForm() {
  const disclosure = screen.getByText("새 개선 작업 등록");
  if (!disclosure.closest("details")?.open) fireEvent.click(disclosure);
  const form = screen
    .getByRole("heading", { name: /새.*작업/ })
    .closest("form");
  if (!form) throw new Error("New task form is missing");
  return form;
}

function taskTitle(form: HTMLFormElement) {
  return within(form).getByRole("textbox", { name: /작업.*제목|task title/i });
}

describe("product operations editing boundaries", () => {
  it("saves a new task to the visible product after a cached product switch", () => {
    state.calls.length = 0;
    const mounted = render(view(firstProduct));
    fireEvent.change(taskTitle(newTaskForm()), {
      target: { value: "첫 번째 제품에서 작성한 초안" },
    });

    // Both records are already available: there is no loading unmount between
    // these props, as when switching between cached product detail routes.
    mounted.rerender(view(secondProduct));
    const secondForm = newTaskForm();
    fireEvent.change(taskTitle(secondForm), {
      target: { value: "현재 제품의 개선 작업" },
    });
    fireEvent.submit(secondForm);

    expect(state.calls).toHaveLength(1);
    expect(state.calls[0]).toMatchObject({
      hookSiteId: secondProduct.id,
      action: "task.save",
      values: {
        site_id: secondProduct.id,
        title: "현재 제품의 개선 작업",
      },
    });
  });

  it("clears the previous save confirmation when entering another unsaved task", () => {
    state.calls.length = 0;
    render(view(firstProduct));
    let form = newTaskForm();
    fireEvent.change(taskTitle(form), {
      target: { value: "저장할 작업" },
    });
    fireEvent.submit(form);
    expect(state.calls).toHaveLength(1);
    form = newTaskForm();
    const savedMessage = within(form).getByRole("status").textContent;
    expect(savedMessage?.trim()).not.toBe("");

    fireEvent.change(taskTitle(form), {
      target: { value: "아직 저장하지 않은 새 작업" },
    });

    expect(state.calls).toHaveLength(1);
    expect(
      within(form).queryByText(savedMessage!, { exact: true }),
    ).not.toBeInTheDocument();
  });
});
