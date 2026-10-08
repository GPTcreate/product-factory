/** Operator-only helper. Requires an inherited private pipe at fd 3. */
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { exchangeAndDeliver } from "./oauth-exchange";
import { openPrivateTransport } from "./oauth-private-transport";

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const port = Number(process.env.GOOGLE_OAUTH_PORT ?? 5179);
const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;
let transport: ReturnType<typeof openPrivateTransport>;
try {
  if (
    !clientId ||
    !clientSecret ||
    !Number.isInteger(port) ||
    port < 1024 ||
    port > 65535
  )
    throw new Error();
  transport = openPrivateTransport();
  if (
    process.env.GOOGLE_OAUTH_REDIRECT &&
    process.env.GOOGLE_OAUTH_REDIRECT !== redirectUri
  )
    throw new Error();
} catch {
  console.error(
    "OAuth requires configured client environment, a loopback redirect and private pipes at fd 3 and stdin. See docs/OAUTH_HELPER.md.",
  );
  process.exit(1);
}
const state = randomBytes(32).toString("hex");
const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.search = new URLSearchParams({
  client_id: clientId!,
  redirect_uri: redirectUri,
  response_type: "code",
  scope: ["webmasters.readonly", "analytics.readonly", "adsense.readonly"]
    .map((s) => `https://www.googleapis.com/auth/${s}`)
    .join(" "),
  access_type: "offline",
  include_granted_scopes: "true",
  prompt: "consent",
  state,
}).toString();
let busy = false;
const server = createServer(async (req, res) => {
  if (req.headers.host !== `127.0.0.1:${port}` || req.method !== "GET") {
    res.writeHead(400).end("Invalid request");
    return;
  }
  const url = new URL(req.url ?? "/", redirectUri);
  if (url.pathname === "/authorize" && !busy) {
    res
      .writeHead(302, {
        Location: authUrl.toString(),
        "Cache-Control": "no-store",
      })
      .end();
    return;
  }
  if (url.pathname !== "/oauth2callback") {
    res.writeHead(404).end("Not found");
    return;
  }
  if (busy) {
    res.writeHead(409).end("Already processing");
    return;
  }
  if (url.searchParams.get("state") !== state) {
    res.writeHead(400).end("Invalid state");
    return;
  }
  busy = true;
  const code = url.searchParams.get("code");
  const ok = code
    ? await exchangeAndDeliver(
        () =>
          fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code,
              client_id: clientId!,
              client_secret: clientSecret!,
              redirect_uri: redirectUri,
              grant_type: "authorization_code",
            }),
            signal: AbortSignal.timeout(30_000),
          }),
        transport.deliver,
        (message) => console.log(message),
      )
    : false;
  res.writeHead(200, {
    "Content-Type": "text/plain",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  });
  res.end(
    ok
      ? "Completed. Return to the private receiver."
      : "OAuth failed. Return to the operator.",
  );
  server.close(() => {
    process.exitCode = ok ? 0 : 1;
  });
});
server.on("error", () => {
  console.error("OAuth listener failed.");
  process.exitCode = 1;
  clearTimeout(deadline);
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `Open http://127.0.0.1:${port}/authorize locally. Redirect URI: ${redirectUri}`,
  ),
);
server.setTimeout(30_000);
const deadline = setTimeout(() => {
  console.error("OAuth session expired.");
  server.close();
  process.exitCode = 1;
}, 5 * 60_000);
server.on("close", () => {
  clearTimeout(deadline);
  transport.close();
});
