import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { mkdtemp, chmod, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const PROJECT_REF = "nemkjxdxswwtrlufcykp";
export const GOOGLE_PROJECT = "product-factory-510706";
export const REDIRECT = "http://127.0.0.1:5179/oauth2callback";
const keys = new Set([
  "AUTOMATION_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
]);
const googleKeys = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
];
const googleScopes = [
  "analytics.readonly",
  "webmasters.readonly",
  "adsense.readonly",
].map((scope) => `https://www.googleapis.com/auth/${scope}`);
export function secretDigest(value) {
  return createHash("sha256").update(value).digest("hex");
}

/** The CLI JSON calls the SHA-256 digest `value`; some inventory APIs call it
 * `digest`. Accept only hashes, and keep names even if a digest is unavailable
 * so an unknown existing credential can never be mistaken for an absent one. */
export function readSecretInventory(result) {
  const found = new Map();
  const scan = (item) => {
    if (!item || typeof item !== "object") return;
    if (typeof item.name === "string") {
      const digest = item.digest ?? item.value;
      found.set(
        item.name,
        typeof digest === "string" && /^[a-f0-9]{64}$/i.test(digest)
          ? digest.toLowerCase()
          : undefined,
      );
    }
    for (const value of Object.values(item))
      if (value && typeof value === "object") scan(value);
  };
  scan(result);
  return found;
}

/** Rotation is explicit and can only replace the refresh token for the same client.
 * Inventory contains CLI digests, never existing secret values. */
export function googleSecretPayload(client, token, inventory, rotate = false) {
  if (rotate) {
    if (
      !googleKeys.every((key) => inventory.has(key)) ||
      inventory.get("GOOGLE_CLIENT_ID") !== secretDigest(client.id) ||
      inventory.get("GOOGLE_CLIENT_SECRET") !== secretDigest(client.secret)
    )
      throw new Error("Existing Google client could not be confirmed");
    return { GOOGLE_REFRESH_TOKEN: token };
  }
  if (googleKeys.some((key) => inventory.has(key)))
    throw new Error("Existing Google settings require explicit rotation");
  return {
    GOOGLE_CLIENT_ID: client.id,
    GOOGLE_CLIENT_SECRET: client.secret,
    GOOGLE_REFRESH_TOKEN: token,
  };
}

/** Validate a candidate before changing working production credentials.
 * Provider response bodies and access tokens never leave this function. */
export async function verifyGoogleRefreshToken(
  client,
  token,
  targets,
  request = fetch,
) {
  try {
    if (!/^\d+$/.test(targets?.ga4Property ?? "") || !targets?.gscSite)
      return false;
    const response = await request("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: client.id,
        client_secret: client.secret,
        refresh_token: token,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const body = await response.json();
    if (
      !response.ok ||
      typeof body.access_token !== "string" ||
      typeof body.scope !== "string"
    )
      return false;
    const granted = new Set(body.scope.split(/\s+/));
    if (
      granted.size !== googleScopes.length ||
      !googleScopes.every((scope) => granted.has(scope))
    )
      return false;
    const headers = { Authorization: `Bearer ${body.access_token}` };
    const checks = await Promise.all([
      request(
        `https://analyticsdata.googleapis.com/v1beta/properties/${targets.ga4Property}/metadata`,
        { headers, signal: AbortSignal.timeout(30_000) },
      ),
      request("https://www.googleapis.com/webmasters/v3/sites", {
        headers,
        signal: AbortSignal.timeout(30_000),
      }),
    ]);
    body.access_token = "";
    if (!checks.every((result) => result.ok)) return false;
    const sites = await checks[1].json();
    return (
      Array.isArray(sites.siteEntry) &&
      sites.siteEntry.some(
        (site) =>
          site.siteUrl === targets.gscSite &&
          site.permissionLevel !== "siteUnverifiedUser",
      )
    );
  } catch {
    return false;
  }
}

// CLI token names may contain spaces. Wait for a full output line before
// validating the official URL so a partial PTY chunk cannot become a link.
export function readLoginURL(output) {
  const match = output.match(
    /https:\/\/supabase\.com\/dashboard\/cli\/login\?[^\r\n]+\r?\n/,
  );
  if (!match) return undefined;
  try {
    const url = new URL(match[0].trim());
    if (
      url.origin !== "https://supabase.com" ||
      url.pathname !== "/dashboard/cli/login" ||
      !["session_id", "token_name", "public_key"].every((key) =>
        url.searchParams.get(key),
      )
    )
      return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

/** Credential dialogs can put full secrets in accessible copy-button names.
 * Never log a filtered line or a raw snapshot: return fixed booleans only. */
export function safeAuthPageState(snapshot) {
  return {
    googleClientCreated: /OAuth 클라이언트 생성됨/.test(snapshot),
    googleJsonDownloadAvailable: /JSON 다운로드/.test(snapshot),
    supabaseSignInRequired: /Sign in to your account/.test(snapshot),
    cliVerificationVisible:
      /verification code|Verification code|확인 코드/.test(snapshot),
  };
}

export function readClient(input) {
  const root = JSON.parse(input);
  const client = root.web;
  if (
    !client ||
    client.project_id !== GOOGLE_PROJECT ||
    !/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(client.client_id) ||
    typeof client.client_secret !== "string" ||
    !/^[A-Za-z0-9_-]{16,256}$/.test(client.client_secret) ||
    !client.redirect_uris?.includes(REDIRECT)
  )
    throw new Error("Invalid client configuration");
  return { id: client.client_id, secret: client.client_secret };
}

export function requestAllowed(req, port, csrf) {
  const provided = req.headers["x-factory-csrf"];
  return (
    req.headers.host === `127.0.0.1:${port}` &&
    req.headers.origin === `http://127.0.0.1:${port}` &&
    typeof provided === "string" &&
    Buffer.byteLength(provided) === Buffer.byteLength(csrf) &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(csrf))
  );
}

export function secretEnv(values) {
  const pairs = Object.entries(values);
  if (
    !pairs.length ||
    pairs.some(
      ([key, value]) =>
        !keys.has(key) ||
        typeof value !== "string" ||
        !/^[A-Za-z0-9._~+/=-]{16,4096}$/.test(value),
    )
  )
    throw new Error("Invalid secret payload");
  return Buffer.from(pairs.map(([k, v]) => `${k}=${v}\n`).join(""));
}

/** No secret values in child arguments, stdout, stderr, or regular files. */
export async function writeSecrets(binary, values, options = {}) {
  const bytes = secretEnv(values);
  const directory =
    process.platform === "win32"
      ? null
      : await mkdtemp(join(tmpdir(), "factory-secrets-"));
  if (directory) await chmod(directory, 0o700);
  const pipe =
    process.platform === "win32"
      ? `\\\\.\\pipe\\factory-secrets-${randomBytes(24).toString("hex")}`
      : join(directory, "secrets.sock");
  const server = createServer();
  const sockets = new Set();
  let opened = false;
  let timeout;
  let child;
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(pipe, resolve);
    });
    server.on("connection", (socket) => {
      if (opened) return socket.destroy();
      opened = true;
      sockets.add(socket);
      socket.once("close", () => sockets.delete(socket));
      socket.on("error", () => {});
      socket.end(bytes);
    });
    const args = options.args?.(pipe) ?? [
      "secrets",
      "set",
      "--project-ref",
      PROJECT_REF,
      "--env-file",
      pipe,
      "--agent",
      "no",
      "--output-format",
      "text",
    ];
    const status = await new Promise((resolve) => {
      child = spawn(binary, args, {
        stdio: ["ignore", "ignore", "ignore"],
        windowsHide: true,
        env: { ...process.env, NO_COLOR: "1" },
      });
      timeout = setTimeout(() => {
        child.kill();
        resolve(false);
      }, options.timeout ?? 60_000);
      child.once("error", () => resolve(false));
      child.once("exit", (code) => resolve(code === 0 && opened));
    });
    return status;
  } finally {
    clearTimeout(timeout);
    bytes.fill(0);
    for (const socket of sockets) socket.destroy();
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    server.unref();
    if (directory) {
      await unlink(pipe).catch(() => {});
      await rmdir(directory).catch(() => {});
    }
  }
}
