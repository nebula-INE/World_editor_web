import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const root = process.cwd();
const sourceFixturePath = path.join(root, "tests/fixtures/axral-project-v1.json");
const sharedFixture = JSON.parse(await readFile(sourceFixturePath, "utf8"));
const crossLoadInputPath = process.env.AXRAL_CROSSLOAD_INPUT;
const fixture = crossLoadInputPath
  ? JSON.parse(await readFile(crossLoadInputPath, "utf8"))
  : sharedFixture;
assert.deepEqual(fixture, sharedFixture, "cross-loaded Desktop project must match the shared v1 contract fixture");
const tempDir = await mkdtemp(path.join(tmpdir(), "axral-project-ui-"));
const fixturePath = crossLoadInputPath || path.join(tempDir, "Desktop-fixture.axral.json");
if (!crossLoadInputPath) await writeFile(fixturePath, JSON.stringify(fixture, null, 2));
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
  let invalidProjectAlertSeen = false;
  page.on("dialog", async (dialog) => {
    if (dialog.type() === "confirm") {
      await dialog.accept();
      return;
    }
    assert.match(dialog.message(), /プロジェクトを読み込めませんでした/);
    invalidProjectAlertSeen = true;
    await dialog.accept();
  });

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
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#menu-save-project").click();
  const download = await downloadPromise;
  const savedPath = path.join(tempDir, download.suggestedFilename());
  await download.saveAs(savedPath);
  const saved = JSON.parse(await readFile(savedPath, "utf8"));
  assert.deepEqual(saved, fixture, "UI save must preserve the shared v1 fixture exactly");
  const outputDir = process.env.AXRAL_CROSSLOAD_OUTPUT_DIR;
  if (outputDir) {
    const outputPath = path.join(outputDir, "web-roundtrip.axral.json");
    await mkdir(outputDir, { recursive: true });
    await copyFile(savedPath, outputPath);
  }

  // Reload the UI-produced file and verify the full project survives a second save.
  await page.locator("#file-menu-button").click();
  await page.locator("#menu-open-file").click();
  await page.locator('input[type="file"]').setInputFiles(savedPath);
  await page.waitForFunction((expected) => {
    const input = document.querySelector("textarea");
    return input instanceof HTMLTextAreaElement && input.value === expected;
  }, fixture.text);

  await page.locator("#file-menu-button").click();
  const secondDownloadPromise = page.waitForEvent("download");
  await page.locator("#menu-save-project").click();
  const secondDownload = await secondDownloadPromise;
  const reSavedPath = path.join(tempDir, `reloaded-${secondDownload.suggestedFilename()}`);
  await secondDownload.saveAs(reSavedPath);
  const reSaved = JSON.parse(await readFile(reSavedPath, "utf8"));
  assert.deepEqual(reSaved, fixture, "reopened project must preserve all v1 fields on a second save");

  // Invalid input must be recoverable and must not replace the open document.
  const beforeInvalidOpen = await editor.inputValue();
  await page.locator('input[type="file"]').setInputFiles({
    name: "broken.axral.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ format: "axral-world-project", schema_version: 999 })),
  });
  await delay(200);
  assert.equal(await editor.inputValue(), beforeInvalidOpen, "malformed project must leave current document intact");
  assert.equal(invalidProjectAlertSeen, true, "malformed project must show a recoverable error");

  // Save once more after the rejected load: the entire open project must remain intact,
  // including non-text fields such as events, graph positions, timeline, and ignored candidates.
  await page.locator("#file-menu-button").click();
  const postInvalidDownloadPromise = page.waitForEvent("download");
  await page.locator("#menu-save-project").click();
  const postInvalidDownload = await postInvalidDownloadPromise;
  const postInvalidPath = path.join(tempDir, `after-invalid-${postInvalidDownload.suggestedFilename()}`);
  await postInvalidDownload.saveAs(postInvalidPath);
  const afterInvalid = JSON.parse(await readFile(postInvalidPath, "utf8"));
  assert.deepEqual(afterInvalid, fixture, "rejected malformed load must preserve the entire current project");

  console.log("Project UI round-trip and malformed-file recovery passed.");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
  await rm(tempDir, { recursive: true, force: true });
}
