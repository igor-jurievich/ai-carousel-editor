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
  const legacyAdvancedToggle = page.locator("details.generate-advanced summary").first();
  const advancedToggle = page.getByRole("button", { name: "Уточнить генерацию" }).first();

  if ((await legacyAdvancedToggle.count()) > 0) {
    await legacyAdvancedToggle.click();
  } else if ((await advancedToggle.count()) > 0) {
    await advancedToggle.click();
  } else {
    failures.push(`generate page: advanced controls toggle not found (url: ${page.url()})`);
    return;
  }
  await page.waitForTimeout(250);

  const nicheField = page.locator('label:has-text("Ниша") input').first();
  const audienceField = page.locator('label:has-text("Целевая аудитория") input').first();
  await nicheField.waitFor({ state: "visible", timeout: 12000 }).catch(() => undefined);
  await audienceField.waitFor({ state: "visible", timeout: 12000 }).catch(() => undefined);
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
      () => document.querySelectorAll(".mobile-generate-actions button").length >= 2,
      { timeout: 12000 }
    )
    .catch(() => undefined);

  const controlsProbe = await page.evaluate(() => {
    const normalize = (value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");
    const quickActionButtons = Array.from(document.querySelectorAll(".mobile-status-action"));
    const quickActionsCount = quickActionButtons.filter((button) => {
      const style = getComputedStyle(button);
      return style.display !== "none" && style.visibility !== "hidden";
    }).length;

    const generateButtons = Array.from(document.querySelectorAll(".mobile-generate-actions button"));
    const hasGeneratePlusPost = generateButtons.some((button) =>
      /Сгенерировать \+ пост|Подождите\.\.\./i.test(normalize(button.textContent || ""))
    );

    return {
      quickActionsCount,
      hasGeneratePlusPost
    };
  });
  assert(controlsProbe.quickActionsCount === 0, "editor: quick action strip should be hidden", failures);

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
  const generatePanel = page.locator("details").filter({ hasText: "Создать новую карусель" }).first();
  const hasGeneratePanel = (await generatePanel.count()) > 0;

  if (!hasGeneratePanel) {
    const postTabButton = page
      .locator(".mobile-editor-shell .mobile-bottom-toolbar-v2 .mobile-bottom-tool")
      .filter({ hasText: "Пост" })
      .first();
    if ((await postTabButton.count()) === 0) {
      failures.push("editor flow: cannot find generate panel or mobile 'Пост' tab");
      return;
    }

    await postTabButton.click({ timeout: 12000 });
    await page.locator(".mobile-tool-sheet-v2 h3").first().waitFor({ state: "visible", timeout: 12000 });
    const sheetTitle = await page.locator(".mobile-tool-sheet-v2 h3").first().textContent();
    assert(
      normalize(sheetTitle) === "Подпись к посту",
      "editor flow: post tool sheet did not open from toolbar fallback",
      failures
    );
    return;
  }

  await generatePanel.evaluate((node) => {
    node.open = true;
  });
  await generatePanel.locator("textarea").first().fill("Тестовая тема для мобильного прогона");
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

  const tabsToCheck = ["Шаблоны", "Пост", "Цвет", "Фон", "Стиль", "Текст", "Шрифт", "Размер"];
  const toolButtons = page.locator(".mobile-editor-shell .mobile-bottom-toolbar-v2 .mobile-bottom-tool:visible");
  const totalButtons = await toolButtons.count();
  assert(totalButtons >= 8, `tool sheet: expected 8 mobile bottom tools, got ${totalButtons}`, failures);

  for (const label of tabsToCheck) {
    const tabButton = toolButtons.filter({ hasText: label }).first();
    const tabExists = (await tabButton.count()) > 0;
    if (!tabExists) {
      failures.push(`tool sheet: tab button "${label}" is missing`);
      continue;
    }

    await tabButton.evaluate((node) => {
      node.scrollIntoView({ inline: "center", block: "nearest", behavior: "instant" });
    });
    await tabButton.dispatchEvent("click");
    await page.waitForTimeout(280);

    const probe = await page.evaluate(() => {
      const sheet = document.querySelector(".mobile-tool-sheet.mobile-tool-sheet-v2");
      const toolbar = document.querySelector(".mobile-bottom-toolbar-v2");
      const slideTools = document.querySelector(".mobile-slide-tools");
      const sideInsert = document.querySelector(".mobile-side-insert");
      const sideNav = document.querySelector(".mobile-side-nav");
      const templateTrigger = document.querySelector(".template-library-trigger-mobile");
      const templateModal = document.querySelector(".template-library-modal");
      const selectedPill = document.querySelector(".mobile-tool-sheet-v2 .settings-selected-pill");

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
        isSlideToolsVisible,
        templateTriggerVisible: Boolean(
          templateTrigger &&
            getComputedStyle(templateTrigger).display !== "none" &&
            getComputedStyle(templateTrigger).visibility !== "hidden" &&
            templateTrigger.getBoundingClientRect().height > 2
        ),
        templateModalVisible: Boolean(
          templateModal &&
            getComputedStyle(templateModal).display !== "none" &&
            getComputedStyle(templateModal).visibility !== "hidden" &&
            templateModal.getBoundingClientRect().height > 2
        ),
        sideInsertVisible: Boolean(
          sideInsert &&
            getComputedStyle(sideInsert).display !== "none" &&
            getComputedStyle(sideInsert).visibility !== "hidden" &&
            sideInsert.getBoundingClientRect().height > 2
        ),
        sideNavVisible: Boolean(
          sideNav &&
            getComputedStyle(sideNav).display !== "none" &&
            getComputedStyle(sideNav).visibility !== "hidden" &&
            sideNav.getBoundingClientRect().height > 2
        ),
        selectedPillVisible: Boolean(
          selectedPill &&
            getComputedStyle(selectedPill).display !== "none" &&
            getComputedStyle(selectedPill).visibility !== "hidden" &&
            selectedPill.getBoundingClientRect().height > 2
        )
      };
    });

    const tabRequiresSheet = label !== "Шаблоны";
    if (tabRequiresSheet) {
      assert(probe.sheetVisible, `tool sheet: tab "${label}" did not open`, failures);
      assert(probe.sheetTop >= 0, `tool sheet: tab "${label}" starts above viewport`, failures);
      assert(
        probe.sheetBottom <= probe.viewportHeight + 1,
        `tool sheet: tab "${label}" goes below viewport`,
        failures
      );
      if (probe.toolbarTop > 0) {
        assert(
          probe.sheetBottom <= probe.toolbarTop + 2,
          `tool sheet: tab "${label}" overlaps bottom toolbar`,
          failures
        );
      }
      assert(probe.isSlideToolsVisible, `tool sheet: tab "${label}" hides slide action row`, failures);
    } else {
      assert(
        probe.templateModalVisible || probe.sheetVisible || probe.templateTriggerVisible,
        `tool sheet: tab "${label}" did not open template controls`,
        failures
      );
      if (probe.templateModalVisible) {
        const closeBtn = page.locator(".template-library-modal .editor-modal-close").first();
        if ((await closeBtn.count()) > 0) {
          await closeBtn.click();
          await page.waitForTimeout(200);
        }
      }
    }
    assert(!probe.sideInsertVisible, `tool sheet: tab "${label}" shows side insert controls`, failures);
    assert(!probe.sideNavVisible, `tool sheet: tab "${label}" shows side nav controls`, failures);
    assert(
      !probe.selectedPillVisible,
      `tool sheet: tab "${label}" shows fallback selected-element pill without selection`,
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
