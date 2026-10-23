import { randomBytes, timingSafeEqual } from "node:crypto";
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
