import { describe, expect, it } from "vitest";
import {
  operationsInvocationError,
  operationsSaveError,
} from "./operations-errors";

describe("operational save feedback", () => {
  it("explains actionable validation and MFA failures in Korean", async () => {
    expect(
      operationsSaveError({
        message: "Completed tasks need evidence or completion notes",
      }),
    ).toContain("완료 내용");
    expect(
      operationsSaveError({ message: "Week must start on Monday" }),
    ).toContain("월요일");
    expect(
      await operationsInvocationError({
        context: new Response(
          JSON.stringify({ message: "MFA verification (aal2) required" }),
        ),
      }),
    ).toContain("2단계 인증");
  });

  it("keeps arbitrary server details out of the UI, including non-JSON responses", async () => {
    const expected = operationsSaveError();
    expect(
      operationsSaveError({ message: "token=private-internal-detail" }),
    ).toBe(expected);
    expect(
      await operationsInvocationError({
        context: new Response("internal failure"),
      }),
    ).toBe(expected);
    expect(await operationsInvocationError(new Error("network detail"))).toBe(
      expected,
    );
  });
});
