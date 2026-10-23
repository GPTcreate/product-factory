import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { stripVTControlCharacters } from "node:util";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import {
  readClient,
  requestAllowed,
  writeSecrets,
  PROJECT_REF,
} from "./secure-factory-setup-core.mjs";

// Explicit operator workflow. Uses only the existing project and official CLI.
// Inputs and provider output stay in memory; HTTP access logs are disabled.
const binary = process.env.FACTORY_SUPABASE_CLI;
if (!binary || process.platform !== "win32") {
  console.error("A local Windows Supabase CLI path is required.");
  process.exit(1);
}
const pty = createRequire(import.meta.url)(
  resolve(".agent/tools/auth-runtime-small/node_modules/@lydell/node-pty"),
);
const port = 5180;
const csrf = randomBytes(32).toString("hex");
let loginChild,
  googleChild,
  client,
  loginURL,
  loginText = "",
  googleFrame = "";
let loginGeneration = 0;
let loginPending = false,
  busy = false;
const state = {
  loginReady: false,
  loggedIn: false,
  automationConfigured: false,
  clientLoaded: false,
  googleReady: false,
  googleStored: false,
  message: "Supabase CLI 로그인 준비 중",
};

function cli(args) {
  return new Promise((resolve) => {
    const child = spawn(
      binary,
      [
        ...args,
        "--output",
        "json",
        "--output-format",
        "json",
        "--agent",
        "yes",
      ],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    let output = "";
    child.stdout.on("data", (b) => {
      if (output.length < 100_000) output += b;
    });
    child.stderr.resume();
    const timeout = setTimeout(() => child.kill(), 30_000);
    child.on("error", () => {
      clearTimeout(timeout);
      resolve(null);
    });
    child.on("exit", (code) => {
      clearTimeout(timeout);
      try {
        resolve(code === 0 ? JSON.parse(output) : null);
      } catch {
        resolve(null);
      }
      output = "";
    });
  });
}
async function names() {
  const result = await cli(["secrets", "list", "--project-ref", PROJECT_REF]);
  if (!result) throw new Error("Secret inventory unavailable");
  const found = new Set();
  const scan = (value) => {
    if (!value || typeof value !== "object") return;
    if (typeof value.name === "string") found.add(value.name);
    for (const item of Object.values(value))
      if (typeof item === "object") scan(item);
  };
  scan(result);
  if (!found.has("BING_WEBMASTER_API_KEY"))
    throw new Error("Project inventory could not be confirmed");
  return found;
}
async function prepareAutomation() {
  busy = true;
  try {
    const existing = await names();
    if (existing.has("AUTOMATION_SECRET")) {
      state.automationConfigured = true;
      state.message =
        "기존 예약 인증을 보존했습니다. 다음 단계에서 Vault 연결을 검증합니다.";
      return;
    }
    let secret = randomBytes(32).toString("base64url");
    const ok = await writeSecrets(binary, { AUTOMATION_SECRET: secret });
    secret = "";
    if (!ok) throw new Error("Private secret delivery failed");
    state.automationConfigured = (await names()).has("AUTOMATION_SECRET");
    state.message = state.automationConfigured
      ? "예약 수집 인증을 기존 Edge Secrets에 저장했습니다. 값은 표시하지 않습니다."
      : "예약 인증 저장 확인 실패. 상태 진단이 필요합니다.";
  } catch {
    state.message = "예약 인증 준비 실패. 원문과 인증값은 표시하지 않습니다.";
  } finally {
    busy = false;
  }
}
function startLogin(restart = false) {
  if (state.loggedIn || busy || (loginPending && !restart)) return;
  const generation = ++loginGeneration;
  if (restart) {
    try {
      loginChild?.kill();
    } catch {
      /* An expired request may already be closed. */
    }
  }
  loginPending = true;
  loginText = "";
  loginURL = undefined;
  state.loginReady = false;
  state.message = "Supabase CLI 로그인 링크 준비 중";
  loginChild = pty.spawn(
    binary,
    [
      "login",
      "--no-browser",
      "--name",
      "Product Factory local setup",
      "--output-format",
      "text",
      "--agent",
      "no",
    ],
    {
      name: "xterm-color",
      cols: 2000,
      rows: 30,
      cwd: process.cwd(),
      env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
    },
  );
  const capture = (bytes) => {
    if (generation !== loginGeneration) return;
    loginText = (loginText + stripVTControlCharacters(bytes.toString())).slice(
      -20_000,
    );
    const match = loginText.match(
      /https:\/\/supabase\.com\/dashboard\/cli\/login\?[^\s]+/,
    );
    if (match) {
      const url = new URL(match[0]);
      if (
        url.origin === "https://supabase.com" &&
        url.pathname === "/dashboard/cli/login"
      ) {
        loginURL = url.href;
        state.loginReady = true;
        state.message =
          "Supabase 공식 로그인 창에서 인증 후, 표시된 CLI 확인 코드를 아래 보호 입력란에 입력하세요.";
      }
    }
  };
  loginChild.onData(capture);
  loginChild.onExit(async ({ exitCode: code }) => {
    if (generation !== loginGeneration) return;
    loginPending = false;
    loginText = "";
    loginURL = undefined;
    state.loginReady = false;
    if (code !== 0) {
      state.message =
        "CLI 로그인이 완료되지 않았습니다. 로그인 재시작을 누르세요.";
      return;
    }
    state.loggedIn = true;
    state.message = "CLI 로그인 완료. 기존 프로젝트의 예약 인증을 준비합니다.";
    await prepareAutomation();
  });
}
async function startGoogle() {
  if (!state.loggedIn || !client || googleChild || busy) return false;
  const existing = await names();
  if (
    ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"].some(
      (k) => existing.has(k),
    )
  ) {
    state.message =
      "Google 설정이 이미 존재합니다. 자동 덮어쓰기를 중단했습니다.";
    return false;
  }
  googleFrame = "";
  state.googleReady = false;
  googleChild = spawn(
    process.execPath,
    ["--import", "tsx", "scripts/google-oauth.ts"],
    {
      cwd: process.cwd(),
      windowsHide: true,
      env: {
        ...process.env,
        GOOGLE_CLIENT_ID: client.id,
        GOOGLE_CLIENT_SECRET: client.secret,
      },
      stdio: ["pipe", "pipe", "pipe", "pipe"],
    },
  );
  googleChild.stdout.on("data", (b) => {
    if (b.toString().includes("Open http://127.0.0.1:5179/authorize")) {
      state.googleReady = true;
      state.message =
        "Google 인증 준비 완료. Google 읽기 권한 동의를 직접 완료해 주세요.";
    }
  });
  googleChild.stderr.resume();
  googleChild.stdio[3].on("data", async (bytes) => {
    googleFrame += bytes.toString("utf8");
    if (googleFrame.length > 8192) {
      googleChild?.kill();
      googleFrame = "";
      return;
    }
    if (!googleFrame.endsWith("\n") || busy) return;
    busy = true;
    try {
      const payload = JSON.parse(googleFrame);
      googleFrame = "";
      const ok = await writeSecrets(binary, {
        GOOGLE_CLIENT_ID: client.id,
        GOOGLE_CLIENT_SECRET: client.secret,
        GOOGLE_REFRESH_TOKEN: payload.refresh_token,
      });
      payload.refresh_token = "";
      if (!ok) throw new Error("Delivery failed");
      state.googleStored = true;
      googleChild?.stdin.write("OAUTH_RECEIVED\n");
      client = undefined;
      state.clientLoaded = false;
      state.message =
        "Google 인증 세 항목을 기존 Edge Secrets에 저장했습니다. agent가 실제 수집을 검증할 수 있습니다.";
    } catch {
      state.message =
        "Google 보호 저장 실패. 인증값이나 provider 원문은 표시하지 않습니다.";
      googleChild?.kill();
    } finally {
      busy = false;
    }
  });
  googleChild.on("error", () => {
    googleChild = undefined;
    state.googleReady = false;
    state.message = "Google 인증 helper 시작 실패";
  });
  googleChild.on("exit", () => {
    googleChild = undefined;
    state.googleReady = false;
    googleFrame = "";
    if (!state.googleStored)
      state.message =
        "Google 인증이 끝났거나 만료됐습니다. 필요하면 다시 시작하세요.";
  });
  return true;
}

const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Factory 보안 연결</title><style>body{font:16px system-ui;max-width:760px;margin:40px auto;padding:20px;color:#172b3a}section{border:1px solid #cdd6df;border-radius:12px;padding:22px;margin:18px 0}button,a,input{font:inherit;margin:8px 0;padding:10px}a{display:inline-block}pre{white-space:pre-wrap}label{display:block}</style><h1>Product Factory 보안 연결</h1><p>기존 Supabase product-factory와 Google product-factory-510706만 사용합니다. 인증값은 이 PC 메모리와 공식 CLI의 보호 저장소를 거쳐 기존 Edge Secrets로 전달합니다. 채팅에 값을 보내지 마세요.</p><section><h2>1. Supabase 공식 CLI 로그인</h2><p>공식 Supabase 페이지에서 로그인·확인을 완료한 뒤 표시되는 CLI 확인 코드를 이 입력란에만 입력합니다. 계정 비밀번호나 MFA 코드를 입력하는 칸이 아닙니다.</p><a href="/login" target="_blank" rel="noopener noreferrer">Supabase 공식 CLI 로그인 열기</a><label>CLI 확인 코드<input id="code" type="password" autocomplete="off" maxlength="32"></label><button id="submit-code">코드 전달</button><button id="restart">로그인 재시작</button></section><section><h2>2. Google OAuth 클라이언트 가져오기</h2><p>기존 Google Cloud 프로젝트에서 만든 웹 클라이언트의 JSON을 선택합니다. 콜백은 http://127.0.0.1:5179/oauth2callback 입니다. 파일 내용은 화면이나 로그에 표시하지 않습니다.</p><label>Google 클라이언트 JSON<input id="client" type="file" accept=".json,application/json"></label><button id="import">보호 가져오기</button><button id="google-start">Google 인증 준비</button><a href="http://127.0.0.1:5179/authorize" target="_blank" rel="noopener noreferrer">Google 로그인·읽기 권한 동의 열기</a></section><section><h2>진행 상태</h2><pre id="status">준비 중</pre><p>로그인 완료 후 예약 인증은 자동으로 준비합니다. 기존 인증이 있으면 보존합니다. Google 동의 완료 후 세 설정을 함께 저장하며 값은 반환하지 않습니다.</p></section><script nonce="${csrf}">const csrf=${JSON.stringify(csrf)};async function post(path,body){const r=await fetch(path,{method:'POST',headers:{'x-factory-csrf':csrf,'Content-Type':'application/json'},body:JSON.stringify(body)});return r.ok}document.getElementById('submit-code').onclick=async()=>{const el=document.getElementById('code');await post('/login-code',{code:el.value});el.value=''};document.getElementById('restart').onclick=()=>post('/restart',{});document.getElementById('import').onclick=async()=>{const el=document.getElementById('client');if(el.files[0])await post('/client',{json:await el.files[0].text()});el.value=''};document.getElementById('google-start').onclick=()=>post('/google',{});async function status(){try{const s=await(await fetch('/status')).json();document.getElementById('status').textContent=['Supabase CLI: '+(s.loggedIn?'완료':s.loginReady?'본인 확인 대기':'준비 중'),'예약 인증: '+(s.automationConfigured?'설정됨':'대기'),'Google JSON: '+(s.clientLoaded?'메모리에 준비됨':'대기'),'Google 인증: '+(s.googleStored?'보호 저장 완료':s.googleReady?'본인 동의 대기':'대기'),'',s.message].join('\\n')}catch{}}setInterval(status,2000);status()</script></html>`;
const server = createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Content-Security-Policy",
    `default-src 'none'; script-src 'nonce-${csrf}'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
  );
  const reply = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.headers.host !== `127.0.0.1:${port}`)
    return reply(403, { ok: false });
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html;charset=utf-8" });
    return res.end(html);
  }
  if (req.method === "GET" && req.url === "/status") return reply(200, state);
  if (req.method === "GET" && req.url === "/login" && loginURL) {
    res.writeHead(302, { Location: loginURL });
    return res.end();
  }
  if (req.method !== "POST" || !requestAllowed(req, port, csrf))
    return reply(403, { ok: false });
  let text = "";
  try {
    for await (const chunk of req) {
      text += chunk;
      if (text.length > 32_768) return reply(413, { ok: false });
    }
    const input = JSON.parse(text);
    text = "";
    if (req.url === "/restart" && !state.loggedIn && !busy) {
      startLogin(true);
      return reply(200, { ok: true });
    }
    if (
      req.url === "/login-code" &&
      loginPending &&
      /^[A-Za-z0-9]{6,16}$/.test(input.code)
    ) {
      loginChild.write(input.code + "\r");
      input.code = "";
      return reply(200, { ok: true });
    }
    if (req.url === "/client" && !busy && !googleChild) {
      client = readClient(input.json);
      input.json = "";
      state.clientLoaded = true;
      state.message =
        "기존 Google 프로젝트의 클라이언트를 메모리에 준비했습니다.";
      return reply(200, { ok: true });
    }
    if (req.url === "/google")
      return reply((await startGoogle()) ? 200 : 409, {
        ok: state.googleReady,
      });
    return reply(400, { ok: false });
  } catch {
    state.message =
      "입력 또는 보호 전달을 처리하지 못했습니다. 원문은 표시하지 않습니다.";
    return reply(400, { ok: false });
  }
});
server.on("error", () => {
  console.error("Local setup could not start; no credentials were printed.");
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  console.log(`Local protected setup: http://127.0.0.1:${port}`);
  startLogin();
});
function stop() {
  try {
    loginChild?.kill();
  } catch {
    // The CLI may already have exited.
  }
  googleChild?.kill();
  client = undefined;
  loginText = "";
  googleFrame = "";
  server.close();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setTimeout(stop, 30 * 60_000).unref();
