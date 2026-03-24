import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.EXPORT_SMOKE_BASE_URL || process.env.SMOKE_BASE_URL || "http://localhost:3000";
const EXPORT_TIMEOUT_MS = Number(process.env.EXPORT_SMOKE_TIMEOUT_MS || 45000);
const FORMATS = parseList(process.env.EXPORT_SMOKE_FORMATS, ["1:1", "4:5", "9:16"]);
const MODES = parseList(process.env.EXPORT_SMOKE_MODES, ["zip", "png", "jpg", "pdf"]);

const EXT_BY_MODE = {
  zip: ".zip",
  png: ".png",
  jpg: ".jpg",
  pdf: ".pdf"
};

function parseList(raw, fallback) {
  if (!raw || typeof raw !== "string") {
    return fallback;
  }

  const picked = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index);

  return picked.length ? picked : fallback;
}

function assert(condition, message, failures) {
  if (!condition) {
    failures.push(message);
  }
}

async function withRetry(fn, attempts = 4, delayMs = 300) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

async function setFormat(page, format) {
  await page
    .locator(`.settings-card-format .segment-item:has-text("${format}"):visible`)
    .first()
    .click();
  await page.waitForTimeout(120);
}

async function setExportMode(page, mode) {
  const settingsModeSelect = page.locator(".settings-card-export .select").first();
  await withRetry(async () => {
    await settingsModeSelect.waitFor({ state: "visible", timeout: 15000 });
    await settingsModeSelect.selectOption(mode);
  });
  await page.waitForTimeout(100);
}

async function openModal(page) {
  const modal = page.locator(".slide-export-modal:visible").first();

  await withRetry(async () => {
    const openButton = page
      .locator('.settings-card-export .btn:has-text("Выбрать слайды"):visible')
      .first();
    await openButton.waitFor({ state: "visible", timeout: 10000 });
    await openButton.scrollIntoViewIfNeeded();
    await page.keyboard.press("Escape").catch(() => undefined);
    await openButton.click();
    await modal.waitFor({ state: "visible", timeout: 15000 });
  });

  return modal;
}

async function waitExportReady(page) {
  await page.locator('.settings-card-export .btn:has-text("Выбрать слайды")').first().waitFor({
    state: "visible",
    timeout: EXPORT_TIMEOUT_MS
  });
}

async function runCase(page, downloadsDir, format, mode) {
  await setFormat(page, format);
  await setExportMode(page, mode);
  const modal = await openModal(page);

  const confirmButton = modal.locator(".modal-primary-btn:visible").first();
  await confirmButton.waitFor({ state: "visible", timeout: 10000 });
  if (await confirmButton.isDisabled()) {
    throw new Error(`export modal confirm is disabled for ${format}/${mode}`);
  }

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: EXPORT_TIMEOUT_MS }),
    confirmButton.click()
  ]);

  const suggestedFilename = download.suggestedFilename();
  const expectedExt = EXT_BY_MODE[mode] || "";
  const normalizedFilename = suggestedFilename.toLowerCase();
  const acceptableExt =
    mode === "png" || mode === "jpg"
      ? [expectedExt, ".zip"]
      : [expectedExt];
  const targetPath = path.join(downloadsDir, `${format.replace(":", "x")}-${mode}-${suggestedFilename}`);
  await download.saveAs(targetPath);
  await modal.waitFor({ state: "hidden", timeout: EXPORT_TIMEOUT_MS });
  await waitExportReady(page);

  return {
    format,
    mode,
    suggestedFilename,
    filePath: targetPath,
    expectedExt,
    matchesExt: acceptableExt.some((ext) => normalizedFilename.endsWith(ext))
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  const failures = [];
  const results = [];
  const downloadsDir = path.resolve(process.cwd(), "test-results", "export-downloads");
  await mkdir(downloadsDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true
  });

  try {
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/editor`, { waitUntil: "networkidle" });
    await page.locator('.prompt-composer textarea').first().fill("Тестовая тема для проверки экспорта");
    await page.locator(".settings-card-export .select").first().waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(200);

    for (const format of FORMATS) {
      for (const mode of MODES) {
        try {
          const result = await runCase(page, downloadsDir, format, mode);
          results.push(result);
          assert(
            result.matchesExt,
            `unexpected extension for ${format}/${mode}: ${result.suggestedFilename}`,
            failures
          );
        } catch (error) {
          failures.push(
            `export failed for ${format}/${mode}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }

    await page.close();
  } finally {
    await context.close();
    await browser.close();
  }

  const report = {
    startedAt,
    finishedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    formats: FORMATS,
    modes: MODES,
    failed: failures.length,
    results,
    failures
  };

  const outputPath = path.resolve(process.cwd(), "test-results", "export-smoke-latest.json");
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");

  process.stdout.write("\n--- Export smoke summary ---\n");
  process.stdout.write(`base: ${BASE_URL}\n`);
  process.stdout.write(`cases: ${FORMATS.length * MODES.length}\n`);
  process.stdout.write(`failed: ${failures.length}\n`);
  process.stdout.write(`report: ${outputPath}\n`);

  if (failures.length > 0) {
    for (const failure of failures) {
      process.stdout.write(`  - ${failure}\n`);
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write("Export smoke passed.\n");
}

void main();
