/** Never expose provider responses or exceptions to the terminal/browser. */
export async function exchangeAndDeliver(
  exchange: () => Promise<{ ok: boolean; json: () => Promise<unknown> }>,
  deliver: (token: string) => Promise<void>,
  report: (message: string) => void,
): Promise<boolean> {
  try {
    const response = await exchange();
    const body = (await response.json()) as Record<string, unknown> | null;
    if (
      !response.ok ||
      !body ||
      body.error ||
      typeof body.refresh_token !== "string" ||
      !body.refresh_token
    ) {
      report("OAuth exchange failed. Check provider access with the operator.");
      return false;
    }
    await deliver(body.refresh_token);
    report("OAuth completed; token delivered through the private pipe.");
    return true;
  } catch {
    report(
      "OAuth exchange or private delivery failed. No response details are logged.",
    );
    return false;
  }
}
