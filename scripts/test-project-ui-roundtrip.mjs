import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const root = process.cwd();
const fixturePath = path.join(root, "tests/fixtures/axral-project-v1.json");
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const tempDir = await mkdtemp(path.join(tmpdir(), "axral-project-ui-"));
const port = 4179;
const server = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: root,
  stdio: "ignore",
  env: process.env,
});
let browser;

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}`);
      if (response.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error("Vite dev server did not become ready");
}

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`http://127.0.0.1:${port}`);
  const editor = page.locator("textarea").first();
  await editor.waitFor();

  // Load the shared Desktop/Web fixture through the actual File > Open UI.
  await page.locator("#file-menu-button").click();
  await page.locator("#menu-open-file").click();
  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await page.waitForFunction((expected) => {
    const input = document.querySelector("textarea");
    return input instanceof HTMLTextAreaElement && input.value === expected;
  }, fixture.text);

  // Save through the actual File > Save Axral Project UI and verify all portable fields.
  await page.locator("#file-menu-button").click();
  await page.locator("#menu-save-project").click();
  const downloadPromise = page.waitForEvent("download");
  // The menu click above triggers the download synchronously in the app handler.
  const download = await downloadPromise;
  const savedPath = path.join(tempDir, download.suggestedFilename());
  await download.saveAs(savedPath);
  const saved = JSON.parse(await readFile(savedPath, "utf8"));
  assert.deepEqual(saved, fixture, "UI save must preserve the shared v1 fixture exactly");

  // Reload the UI-produced file to cover the second half of the round-trip.
  await page.locator("#file-menu-button").click();
  await page.locator("#menu-open-file").click();
  await page.locator('input[type="file"]').setInputFiles(savedPath);
  await page.waitForFunction((expected) => {
    const input = document.querySelector("textarea");
    return input instanceof HTMLTextAreaElement && input.value === expected;
  }, fixture.text);

  // Invalid input must be recoverable and must not replace the open document.
  const beforeInvalidOpen = await editor.inputValue();
  page.once("dialog", async (dialog) => {
    assert.match(dialog.message(), /プロジェクトを読み込めませんでした/);
    await dialog.accept();
  });
  await page.locator('input[type="file"]').setInputFiles({
    name: "broken.axral.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ format: "axral-world-project", schema_version: 999 })),
  });
  await delay(200);
  assert.equal(await editor.inputValue(), beforeInvalidOpen, "malformed project must leave current document intact");

  console.log("Project UI round-trip and malformed-file recovery passed.");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
  await rm(tempDir, { recursive: true, force: true });
}
