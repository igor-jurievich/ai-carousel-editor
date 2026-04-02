import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, devices } from "playwright";

const BASE_URL = process.env.SMOKE_BASE_URL || process.env.QUALITY_BASE_URL || "http://localhost:3000";
const DEVICE_NAME = process.env.SMOKE_DEVICE || "iPhone 14";

const MOCK_SLIDES = [
  {
    type: "hook",
    title: "Тестовый хук",
    subtitle: "Тестовый подзаголовок",
    bullets: [],
    before: "",
    after: ""
  },
  {
    type: "problem",
    title: "Проблема",
    subtitle: "",
    bullets: ["Первый пункт с деталями", "Второй пункт с деталями"],
    before: "",
    after: ""
  },
  {
    type: "amplify",
    title: "Усиление",
    subtitle: "",
    bullets: ["Уточнение с риском", "Уточнение с ценой ошибки"],
    before: "",
    after: ""
  },
  {
    type: "mistake",
    title: "Типичная ловушка в процессе",
    subtitle: "",
    bullets: [],
    before: "",
    after: ""
  },
  {
    type: "consequence",
    title: "",
    subtitle: "",
    bullets: ["Последствие один для метрик", "Последствие два для команды"],
    before: "",
    after: ""
  },
  {
    type: "shift",
    title: "Сдвиг в подходе к подаче",
    subtitle: "",
    bullets: [],
    before: "",
    after: ""
  },
  {
    type: "solution",
    title: "",
    subtitle: "",
    bullets: ["Шаг один с действием", "Шаг два с действием"],
    before: "",
    after: ""
  },
  {
    type: "example",
    title: "",
    subtitle: "",
    bullets: [],
    before: "До: было размыто и непонятно",
    after: "После: стало ясно и по делу"
  },
  {
    type: "cta",
    title: "Призыв к действию",
    subtitle: "Напишите «ПЛАН» в директ",
    bullets: [],
    before: "",
    after: ""
  }
];

function assert(condition, message, failures) {
  if (!condition) {
    failures.push(message);
  }
}

async function testGeneratePageLayout(page, failures) {
  await page.goto(`${BASE_URL}/generate`, { waitUntil: "networkidle" });
  await page.locator("details.generate-advanced summary").click();
  await page.waitForTimeout(250);

  const nicheField = page.locator('label:has-text("Ниша") input').first();
  const audienceField = page.locator('label:has-text("Целевая аудитория") input').first();
  const nicheBox = await nicheField.boundingBox();
  const audienceBox = await audienceField.boundingBox();

  assert(Boolean(nicheBox), "generate page: niche field is not visible", failures);
  assert(Boolean(audienceBox), "generate page: audience field is not visible", failures);

  if (nicheBox && audienceBox) {
    const oneColumn = Math.abs((audienceBox.y ?? 0) - (nicheBox.y ?? 0)) > 20;
    assert(oneColumn, "generate page: advanced fields are not stacked in one column on mobile", failures);
  }
}

async function testEditorControls(page, failures) {
  await page.goto(`${BASE_URL}/editor`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page
    .waitForFunction(
      () =>
        document.querySelectorAll(".mobile-status-action").length >= 3 &&
        document.querySelectorAll(".mobile-generate-actions button").length >= 2,
      { timeout: 12000 }
    )
    .catch(() => undefined);

  const controlsProbe = await page.evaluate(() => {
    const normalize = (value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");
    const quickActionButtons = Array.from(document.querySelectorAll(".mobile-status-action"));
    const quickActionLabels = quickActionButtons.map((button) => normalize(button.textContent || ""));
    const quickActionsCount = quickActionLabels.filter(Boolean).length;

    const generateButtons = Array.from(document.querySelectorAll(".mobile-generate-actions button"));
    const hasGeneratePlusPost = generateButtons.some((button) =>
      /Сгенерировать \+ пост|Подождите\.\.\./i.test(normalize(button.textContent || ""))
    );

    return {
      quickActionsCount,
      quickActionLabels,
      hasGeneratePlusPost
    };
  });
  assert(controlsProbe.quickActionsCount >= 3, "editor: expected at least 3 quick action buttons", failures);

  const generatePanel = page.locator("details").filter({ hasText: "Создать новую карусель" }).first();
  if ((await generatePanel.count()) > 0) {
    await generatePanel.evaluate((node) => {
      node.open = true;
    });
    await page.waitForTimeout(250);
  }

  assert(controlsProbe.hasGeneratePlusPost, "editor: missing mobile button 'Сгенерировать + пост'", failures);

  const sideInsertCount = await page.locator(".mobile-side-insert").count();
  assert(sideInsertCount === 0, "editor: side insert '+' controls should be hidden on mobile", failures);
}

async function testGenerateAndOpenPostFlow(page, failures) {
  await page.route("**/api/generate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        slides: MOCK_SLIDES,
        project: {
          format: "1:1",
          theme: "light",
          promptVariant: "B",
          language: "ru",
          version: 1
        }
      })
    });
  });

  await page.goto(`${BASE_URL}/editor`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page
    .locator("details")
    .filter({ hasText: "Создать новую карусель" })
    .first()
    .evaluate((node) => {
      node.open = true;
    });
  await page
    .locator("details")
    .filter({ hasText: "Создать новую карусель" })
    .first()
    .locator("textarea")
    .first()
    .fill("Тестовая тема для мобильного прогона");
  const generateRequest = page.waitForRequest(
    (request) => request.url().includes("/api/generate") && request.method() === "POST",
    { timeout: 12000 }
  );
  const generatePlusPostButton = page.locator(".mobile-generate-actions button").nth(1);
  await generatePlusPostButton.click({
    timeout: 12000,
    force: true
  });
  await generateRequest;
  await page.waitForFunction(
    () => {
      const status = document.querySelector(".mobile-status-pill")?.textContent || "";
      const title = document.querySelector(".mobile-tool-sheet-v2 h3")?.textContent || "";
      return status.includes("Открыта вкладка «Пост»") || /Подпись к посту/i.test(title);
    },
    { timeout: 16000 }
  );

  const statusText = (await page.locator(".mobile-status-pill").first().textContent()) || "";
  assert(
    statusText.includes("Открыта вкладка «Пост»"),
    "editor flow: status does not confirm opening Post tab after generation",
    failures
  );

  await page.locator(".mobile-tool-sheet-v2 h3").first().waitFor({ state: "visible", timeout: 12000 });
  const sheetTitle = await page.locator(".mobile-tool-sheet-v2 h3").first().textContent();
  assert(
    normalize(sheetTitle) === "Подпись к посту",
    "editor flow: post tool sheet was not opened after generate+post",
    failures
  );
}

async function testMobileToolSheetLayout(page, failures) {
  await page.goto(`${BASE_URL}/editor`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);

  const tabsToCheck = [
    { label: "Текст", index: 5 },
    { label: "Шрифт", index: 6 },
    { label: "Размер", index: 7 },
    { label: "Фон", index: 3 },
    { label: "Стиль", index: 4 }
  ];
  const toolButtons = page.locator(".mobile-bottom-tool");
  const totalButtons = await toolButtons.count();
  assert(totalButtons >= 8, `tool sheet: expected 8 mobile bottom tools, got ${totalButtons}`, failures);

  for (const tab of tabsToCheck) {
    if (tab.index >= totalButtons) {
      failures.push(`tool sheet: tab button "${tab.label}" is missing`);
      continue;
    }

    const tabButton = toolButtons.nth(tab.index);

    await tabButton.evaluate((node) => {
      node.scrollIntoView({ inline: "center", block: "nearest", behavior: "instant" });
    });
    await tabButton.click({ timeout: 10000, force: true });
    await page.waitForTimeout(200);

    const probe = await page.evaluate(() => {
      const sheet = document.querySelector(".mobile-tool-sheet.mobile-tool-sheet-v2");
      const toolbar = document.querySelector(".mobile-bottom-toolbar-v2");
      const slideTools = document.querySelector(".mobile-slide-tools");

      const sheetRect = sheet?.getBoundingClientRect();
      const toolbarRect = toolbar?.getBoundingClientRect();

      const isSlideToolsVisible = Boolean(
        slideTools &&
          getComputedStyle(slideTools).display !== "none" &&
          getComputedStyle(slideTools).visibility !== "hidden" &&
          slideTools.getBoundingClientRect().height > 2
      );

      return {
        sheetVisible: Boolean(sheetRect && sheetRect.width > 0 && sheetRect.height > 0),
        sheetTop: sheetRect?.top ?? -1,
        sheetBottom: sheetRect?.bottom ?? -1,
        toolbarTop: toolbarRect?.top ?? -1,
        viewportHeight: window.innerHeight,
        isSlideToolsVisible
      };
    });

    assert(probe.sheetVisible, `tool sheet: tab "${tab.label}" did not open`, failures);
    assert(probe.sheetTop >= 0, `tool sheet: tab "${tab.label}" starts above viewport`, failures);
    assert(
      probe.sheetBottom <= probe.viewportHeight + 1,
      `tool sheet: tab "${tab.label}" goes below viewport`,
      failures
    );
    if (probe.toolbarTop > 0) {
      assert(
        probe.sheetBottom <= probe.toolbarTop + 2,
        `tool sheet: tab "${tab.label}" overlaps bottom toolbar`,
        failures
      );
    }
    assert(
      !probe.isSlideToolsVisible,
      `tool sheet: tab "${tab.label}" keeps slide action row visible and stacked`,
      failures
    );
  }
}

function normalize(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim();
}

async function main() {
  const failures = [];
  const startedAt = new Date().toISOString();
  const device = devices[DEVICE_NAME];

  if (!device) {
    throw new Error(`Unknown Playwright device: ${DEVICE_NAME}`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...device });

  try {
    const page = await context.newPage();
    await testGeneratePageLayout(page, failures);
    await page.close();

    const editorPage = await context.newPage();
    await testEditorControls(editorPage, failures);
    await editorPage.close();

    const flowPage = await context.newPage();
    await testGenerateAndOpenPostFlow(flowPage, failures);
    await flowPage.close();

    const layoutPage = await context.newPage();
    await testMobileToolSheetLayout(layoutPage, failures);
    await layoutPage.close();
  } finally {
    await context.close();
    await browser.close();
  }

  const report = {
    startedAt,
    finishedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    device: DEVICE_NAME,
    failed: failures.length,
    failures
  };

  const outputDir = path.resolve(process.cwd(), "test-results");
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "mobile-ui-smoke-latest.json");
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");

  process.stdout.write("\n--- Mobile UI smoke summary ---\n");
  process.stdout.write(`base: ${BASE_URL}\n`);
  process.stdout.write(`device: ${DEVICE_NAME}\n`);
  process.stdout.write(`failed: ${failures.length}\n`);
  process.stdout.write(`report: ${outputPath}\n`);

  if (failures.length) {
    for (const issue of failures) {
      process.stdout.write(`  - ${issue}\n`);
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write("Mobile UI smoke passed.\n");
}

void main();
