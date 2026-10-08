import { spawn } from "node:child_process";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const folder = ".agent/evidence/development-resume-20261008";
const origin = "http://127.0.0.1:5189";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5189",
    "--strictPort",
  ],
  {
    stdio: "ignore",
    env: {
      ...process.env,
      FACTORY_FIXTURE_ONLY: "1",
      VITE_SUPABASE_URL: "https://fixture.supabase.test",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
      VITE_APP_URL: origin,
    },
  },
);
let browser;
try {
  for (let n = 0; n < 50; n++) {
    try {
      if ((await fetch(`${origin}/tests/browser/index.html`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let products = [],
    writes = 0;
  await page.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (url.hostname !== "fixture.supabase.test") return route.abort();
    if (request.method() !== "GET" && request.method() !== "OPTIONS") {
      writes++;
      return route.abort();
    }
    const data = url.pathname.endsWith("/sites") ? products : [];
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
      },
      body: JSON.stringify(data),
    });
  });
  const metadata = {
    product_code: "P123",
    name: "Import fixture",
    domain: "example.com",
    website_url: "https://example.com",
    status: "SCALE",
    is_active: true,
    analytics: { ga4_property_id: "123" },
    adsense: { enabled: true, verified_site_domain: "example.com" },
  };
  const upload = async (value) =>
    page
      .getByLabel("Metadata JSON file")
      .setInputFiles({
        name: "product.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(value)),
      });
  await page.goto(`${origin}/tests/browser/index.html`);
  await page.getByRole("link", { name: "Products", exact: true }).click();
  await page
    .getByRole("button", { name: "Import metadata", exact: true })
    .click();
  await upload({
    ...metadata,
    nested: { refresh_token: "synthetic-hidden-sentinel" },
  });
  await page
    .getByRole("alert")
    .filter({ hasText: "Remove credentials" })
    .waitFor();
  assert(
    !(await page.locator("body").innerText()).includes(
      "synthetic-hidden-sentinel",
    ),
  );
  await upload(metadata);
  await page.getByText("New product", { exact: true }).waitFor();
  assert.equal(writes, 0);
  await mkdir(folder, { recursive: true });
  const preview = page.getByRole("dialog", { name: "Metadata preview" });
  await preview.screenshot({ path: `${folder}/F03-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await preview.evaluate((el) => el.scrollWidth <= el.clientWidth));
  await preview.screenshot({ path: `${folder}/F03-mobile.png` });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page
    .getByRole("button", { name: "Import metadata", exact: true })
    .click();
  await upload(metadata);
  await page
    .getByRole("button", { name: "Fill registration form", exact: true })
    .click();
  const form = page.getByRole("dialog", { name: "Add product", exact: true });
  await form.waitFor();
  assert.equal(
    await form.getByLabel("Active", { exact: true }).isChecked(),
    false,
  );
  assert.equal(
    await form.locator('select[name="status"]').inputValue(),
    "IDEA",
  );
  assert.equal(
    await form.getByLabel("Name", { exact: true }).inputValue(),
    "Import fixture",
  );
  assert.equal(writes, 0);
  await form.getByRole("button", { name: "Close", exact: true }).click();
  products = [
    {
      ...metadata,
      id: "existing",
      status: "LIVE",
      is_active: true,
      ga4_property_id: "456",
      gsc_property: null,
      bing_site_url: null,
      adsense_enabled: true,
      adsense_mapping_key: "old.example.com",
    },
  ];
  await page.goto(`${origin}/tests/browser/index.html`);
  await page.getByRole("link", { name: "Products", exact: true }).click();
  await page
    .getByRole("button", { name: "Import metadata", exact: true })
    .click();
  await upload(metadata);
  await page
    .getByText("Edit existing product: Import fixture", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Fill registration form", exact: true })
    .click();
  const edit = page.getByRole("dialog", { name: "Edit product", exact: true });
  assert.equal(
    await edit.getByLabel("AdSense verified site domain").inputValue(),
    "old.example.com",
  );
  assert.equal(
    await edit.getByLabel("Active", { exact: true }).isChecked(),
    true,
  );
  assert.equal(
    await edit.locator('select[name="status"]').inputValue(),
    "LIVE",
  );
  assert.equal(writes, 0);
  assert.deepEqual(errors, []);
  const evidence = {
    passed: true,
    syntheticOnly: true,
    actualRegistration: false,
    desktop: true,
    mobile: true,
    cancelWithoutSave: true,
    secretExcluded: true,
    existingMappingPreserved: true,
    writes,
    independentlyApproved: false,
  };
  await writeFile(
    `${folder}/F03-browser.json`,
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence));
} finally {
  await browser?.close();
  server.kill();
}
