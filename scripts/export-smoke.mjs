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

async function setFormat(page, format) {
  await page.locator(`.settings-card-format .segment-item:has-text("${format}")`).first().click();
  await page.waitForTimeout(120);
}

async function openModalAndSelectMode(page, mode) {
  await page.locator('.settings-card-export .btn:has-text("Выбрать слайды")').first().click();
  await page.locator(".slide-export-modal").waitFor({ state: "visible", timeout: 10000 });
  await page.locator(".slide-export-mode-row .select").selectOption(mode);
}

async function selectSingleSlide(page) {
  const allToggle = page.locator(".slide-export-all-toggle input").first();
  if (await allToggle.isChecked()) {
    await allToggle.click();
  }

  const firstSlide = page.locator(".slide-export-item input").first();
  if (!(await firstSlide.isChecked())) {
    await firstSlide.click();
  }
}

async function waitExportReady(page) {
  await page.locator('.settings-card-export .btn:has-text("Выбрать слайды")').first().waitFor({
    state: "visible",
    timeout: EXPORT_TIMEOUT_MS
  });
}

async function runCase(page, downloadsDir, format, mode) {
  await setFormat(page, format);
  await openModalAndSelectMode(page, mode);
  await selectSingleSlide(page);

  const confirmButton = page.locator(".modal-primary-btn").first();
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
  const targetPath = path.join(downloadsDir, `${format.replace(":", "x")}-${mode}-${suggestedFilename}`);
  await download.saveAs(targetPath);
  await waitExportReady(page);

  return {
    format,
    mode,
    suggestedFilename,
    filePath: targetPath,
    expectedExt,
    matchesExt: suggestedFilename.toLowerCase().endsWith(expectedExt)
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
