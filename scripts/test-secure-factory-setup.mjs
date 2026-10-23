import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readClient,
  requestAllowed,
  secretEnv,
  writeSecrets,
  REDIRECT,
  GOOGLE_PROJECT,
  safeAuthPageState,
  readLoginURL,
} from "./secure-factory-setup-core.mjs";

test("CLI login links preserve spaced names and require a complete request", () => {
  const url =
    "https://supabase.com/dashboard/cli/login?session_id=synthetic-session&token_name=Product Factory local setup&public_key=synthetic-public-key";
  const parsed = new URL(readLoginURL(`Open ${url}\r\nEnter code:`));
  assert.equal(
    parsed.searchParams.get("token_name"),
    "Product Factory local setup",
  );
  assert.equal(parsed.searchParams.get("public_key"), "synthetic-public-key");
  assert.equal(readLoginURL(url), undefined);
  assert.equal(
    readLoginURL(
      "https://supabase.com/dashboard/cli/login?session_id=synthetic&token_name=Product\n",
    ),
    undefined,
  );
});

const client = {
  web: {
    project_id: GOOGLE_PROJECT,
    client_id: "123-example.apps.googleusercontent.com",
    client_secret: "synthetic_client_secret_123456",
    redirect_uris: [REDIRECT],
  },
};
test("credential page summaries never expose secrets embedded in accessible button names", () => {
  const synthetic = "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credential";
  const summary = safeAuthPageState(
    `OAuth 클라이언트 생성됨\nbutton 클립보드로 복사: ${synthetic}\nbutton JSON 다운로드`,
  );
  assert.equal(summary.googleClientCreated, true);
  assert.equal(summary.googleJsonDownloadAvailable, true);
  assert.equal(JSON.stringify(summary).includes(synthetic), false);
  assert.ok(
    Object.values(summary).every((value) => typeof value === "boolean"),
  );
});
test("client import is limited to the existing project and loopback callback", () => {
  assert.equal(readClient(JSON.stringify(client)).id, client.web.client_id);
  assert.throws(() =>
    readClient(
      JSON.stringify({ web: { ...client.web, project_id: "another-project" } }),
    ),
  );
  assert.throws(() =>
    readClient(
      JSON.stringify({
        web: { ...client.web, redirect_uris: ["https://attacker.test"] },
      }),
    ),
  );
  assert.throws(() =>
    readClient(
      JSON.stringify({
        web: { ...client.web, client_secret: "bad\nINJECT=1" },
      }),
    ),
  );
});
test("local writes require exact Host, Origin, and CSRF", () => {
  const req = {
    headers: {
      host: "127.0.0.1:5180",
      origin: "http://127.0.0.1:5180",
      "x-factory-csrf": "synthetic_nonce",
    },
  };
  assert.equal(requestAllowed(req, 5180, "synthetic_nonce"), true);
  for (const headers of [
    { ...req.headers, origin: "https://attacker.test" },
    { ...req.headers, host: "attacker.test:5180" },
    { ...req.headers, "x-factory-csrf": "wrong" },
  ])
    assert.equal(requestAllowed({ headers }, 5180, "synthetic_nonce"), false);
});
test("secret transport rejects arbitrary configuration and dotenv injection", () => {
  assert.throws(() =>
    secretEnv({ SUPABASE_SECRET_KEY: "synthetic_value_12345" }),
  );
  assert.throws(() =>
    secretEnv({ GOOGLE_CLIENT_SECRET: "synthetic_value_12345\nMORE=value" }),
  );
  const b = secretEnv({ AUTOMATION_SECRET: "synthetic_value_12345" });
  assert.equal(b.toString(), "AUTOMATION_SECRET=synthetic_value_12345\n");
  b.fill(0);
});
test(
  "Windows CLI receives secrets through a pipe, not arguments or files",
  { skip: process.platform !== "win32" },
  async () => {
    const synthetic = "synthetic_value_for_pipe_test_123456";
    let argsSeen;
    const ok = await writeSecrets(
      process.execPath,
      { AUTOMATION_SECRET: synthetic },
      {
        args: (pipe) =>
          (argsSeen = [
            "-e",
            "const fs=require('node:fs');const x=fs.readFileSync(process.argv[1],'utf8');process.exit(x.startsWith('AUTOMATION_SECRET=')&&x.endsWith('\\n')?0:2)",
            pipe,
          ]),
        timeout: 4000,
      },
    );
    assert.equal(ok, true);
    assert.equal(
      argsSeen.some((arg) => arg.includes(synthetic)),
      false,
    );
  },
);
test("a child that never accepts the private payload is not success", async () => {
  assert.equal(
    await writeSecrets(
      process.execPath,
      { AUTOMATION_SECRET: "synthetic_value_12345" },
      { args: () => ["-e", "process.exit(0)"], timeout: 1500 },
    ),
    false,
  );
});
