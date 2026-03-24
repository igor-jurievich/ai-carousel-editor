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

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function main() {
  const report = await readJson(REPORT_PATH);
  const baseline = {
    updatedAt: new Date().toISOString(),
    sourceReport: path.relative(process.cwd(), REPORT_PATH),
    cases: Number(report.cases || 0),
    failed: Number(report.failed || 0),
    runs: Number(report.runs || 0),
    topics: Number(report.topics || 0),
    formats: Array.isArray(report.formats) ? report.formats : [],
    themes: Array.isArray(report.themes) ? report.themes : [],
    failureSummary:
      report.failureSummary && typeof report.failureSummary === "object"
        ? report.failureSummary
        : {}
  };

  await mkdir(path.dirname(BASELINE_PATH), { recursive: true });
  await writeFile(BASELINE_PATH, JSON.stringify(baseline, null, 2), "utf8");

  process.stdout.write("Quality baseline updated.\n");
  process.stdout.write(`baseline: ${BASELINE_PATH}\n`);
  process.stdout.write(`cases: ${baseline.cases}\n`);
  process.stdout.write(`failed: ${baseline.failed}\n`);
}

void main();
