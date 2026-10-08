import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdir, open, writeFile } from "node:fs/promises";
import { once } from "node:events";

const folder = ".agent/evidence/development-resume-20261008";
await mkdir(folder, { recursive: true });
const results = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
for (const kind of ["success", "large", "provider", "exception", "json", "no-pipe", "file", "null", "disconnect", "bad-ack"]) {
  const probe = createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const file = kind === "file" ? await open(`${folder}/rejected-sink.txt`, "w") : null;
  const stdio = ["pipe", "pipe", "pipe"];
  if (kind !== "no-pipe") stdio.push(file ? file.fd : kind === "null" ? "ignore" : "pipe");
  const child = spawn(process.execPath, ["--import", "tsx", "tests/oauth/bootstrap.mjs"], {
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
      GOOGLE_CLIENT_ID: "synthetic-client", GOOGLE_CLIENT_SECRET: "synthetic-sensitive-sentinel",
      GOOGLE_OAUTH_PORT: String(port), OAUTH_FIXTURE_KIND: kind }, stdio,
  });
  const closed = once(child, "close");
  let logs = "", received = "", frame = "", exited = false, exitCode;
  child.stdout.on("data", (chunk) => { logs += chunk; });
  child.stderr.on("data", (chunk) => { logs += chunk; });
  child.stdio[3]?.on("error", () => {});
  child.stdin.on("error", () => {});
  child.stdio[3]?.on("data", (chunk) => {
    frame += chunk;
    if (frame.endsWith("\n")) {
      received = JSON.parse(frame).refresh_token;
      child.stdin.write(kind === "bad-ack" ? "INVALID\n" : "OAUTH_RECEIVED\n");
    }
  });
  child.on("exit", (code) => { exited = true; exitCode = code; });
  let reachedCallback = false, failure = false;
  const rejected = ["no-pipe", "file", "null"].includes(kind);
  try {
    for (let n = 0; n < 100 && !exited && !logs.includes("Open http"); n++) await sleep(50);
    if (!rejected && !exited) {
      if (kind === "disconnect") { child.stdio[3].destroy(); await sleep(100); }
      const response = await fetch(`http://127.0.0.1:${port}/authorize`, { redirect: "manual", signal: AbortSignal.timeout(5000) });
      const state = new URL(response.headers.get("location")).searchParams.get("state");
      const invalid = await fetch(`http://127.0.0.1:${port}/oauth2callback?state=invalid&code=synthetic-code`);
      if (invalid.status !== 400) failure = true;
      const callback = await fetch(`http://127.0.0.1:${port}/oauth2callback?state=${state}&code=synthetic-code`, { signal: AbortSignal.timeout(15000) });
      reachedCallback = callback.status === 200;
      logs += await callback.text();
    }
    for (let n = 0; n < 100 && !exited; n++) await sleep(50);
    if (!exited) failure = true;
  } catch { failure = true; }
  finally { if (!exited) child.kill(); await closed; await file?.close(); }
  const success = ["success", "large"].includes(kind);
  const privateDelivery = success || kind === "bad-ack" ? received === "synthetic-sensitive-sentinel".repeat(kind === "large" ? 8192 : 1) : received === "";
  const logsClean = !logs.includes("synthetic-sensitive-sentinel") && !logs.includes("synthetic-code");
  const fileEmpty = !file || (await import("node:fs/promises")).stat(`${folder}/rejected-sink.txt`).then(s => s.size === 0);
  const passed = !failure && logsClean && privateDelivery && await fileEmpty && (rejected || reachedCallback) && exitCode === (success ? 0 : 1);
  results.push({ kind, passed, exitCode, reachedCallback, privateDelivery, logsClean });
  received = ""; frame = ""; logs = "";
}
const evidence = { platform: process.platform, node: process.version, syntheticOnly: true, actualOAuth: false, independentlyApproved: false, results };
await writeFile(`${folder}/oauth-transport.json`, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence));
process.exitCode = results.every(r => r.passed) ? 0 : 1;
