import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const REPORT_PATH = path.resolve(
  process.cwd(),
  process.env.QUALITY_REPORT_PATH || "test-results/quality-gate-latest.json"
);
const BASELINE_PATH = path.resolve(
  process.cwd(),
  process.env.QUALITY_BASELINE_PATH || "quality/quality-baseline.json"
);
const OUTPUT_PATH = path.resolve(
  process.cwd(),
  process.env.QUALITY_DIFF_OUTPUT_PATH || "test-results/quality-baseline-diff-latest.json"
);

const ALLOWED_FAILURE_DELTA = Number(process.env.QUALITY_ALLOWED_FAILURE_DELTA || 0);
const ALLOWED_FAILURE_RATE_DELTA = Number(process.env.QUALITY_ALLOWED_FAILURE_RATE_DELTA || 0);
const ALLOWED_CATEGORY_DELTA = Number(process.env.QUALITY_ALLOWED_CATEGORY_DELTA || 0);

function asNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function calculateRate(failed, cases) {
  if (!cases) {
    return 0;
  }
  return failed / cases;
}

async function main() {
  const baseline = await readJson(BASELINE_PATH);
  const current = await readJson(REPORT_PATH);

  const baselineFailed = asNumber(baseline.failed);
  const baselineCases = asNumber(baseline.cases);
  const baselineRate = calculateRate(baselineFailed, baselineCases);
  const baselineSummary =
    baseline.failureSummary && typeof baseline.failureSummary === "object"
      ? baseline.failureSummary
      : {};

  const currentFailed = asNumber(current.failed);
  const currentCases = asNumber(current.cases);
  const currentRate = calculateRate(currentFailed, currentCases);
  const currentSummary =
    current.failureSummary && typeof current.failureSummary === "object"
      ? current.failureSummary
      : {};

  const issues = [];

  if (currentFailed > baselineFailed + ALLOWED_FAILURE_DELTA) {
    issues.push(
      `total failed increased: ${currentFailed} > ${baselineFailed} + ${ALLOWED_FAILURE_DELTA}`
    );
  }

  if (currentRate > baselineRate + ALLOWED_FAILURE_RATE_DELTA) {
    issues.push(
      `failure rate increased: ${currentRate.toFixed(4)} > ${baselineRate.toFixed(4)} + ${ALLOWED_FAILURE_RATE_DELTA.toFixed(4)}`
    );
  }

  const categories = new Set([
    ...Object.keys(baselineSummary),
    ...Object.keys(currentSummary)
  ]);
  const categoryDiff = {};

  for (const category of categories) {
    const currentValue = asNumber(currentSummary[category]);
    const baselineValue = asNumber(baselineSummary[category]);
    const delta = currentValue - baselineValue;

    categoryDiff[category] = {
      baseline: baselineValue,
      current: currentValue,
      delta
    };

    if (currentValue > baselineValue + ALLOWED_CATEGORY_DELTA) {
      issues.push(
        `category "${category}" increased: ${currentValue} > ${baselineValue} + ${ALLOWED_CATEGORY_DELTA}`
      );
    }
  }

  const result = {
    createdAt: new Date().toISOString(),
    reportPath: REPORT_PATH,
    baselinePath: BASELINE_PATH,
    allowed: {
      failureDelta: ALLOWED_FAILURE_DELTA,
      failureRateDelta: ALLOWED_FAILURE_RATE_DELTA,
      categoryDelta: ALLOWED_CATEGORY_DELTA
    },
    baseline: {
      cases: baselineCases,
      failed: baselineFailed,
      failureRate: baselineRate,
      failureSummary: baselineSummary
    },
    current: {
      cases: currentCases,
      failed: currentFailed,
      failureRate: currentRate,
      failureSummary: currentSummary
    },
    categoryDiff,
    issues,
    ok: issues.length === 0
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(result, null, 2), "utf8");

  process.stdout.write("--- Quality Baseline Diff ---\n");
  process.stdout.write(`baseline: ${BASELINE_PATH}\n`);
  process.stdout.write(`current: ${REPORT_PATH}\n`);
  process.stdout.write(`output: ${OUTPUT_PATH}\n`);
  process.stdout.write(`ok: ${result.ok}\n`);

  if (!result.ok) {
    for (const issue of issues) {
      process.stdout.write(`  - ${issue}\n`);
    }
    process.exitCode = 1;
  }
}

void main();
