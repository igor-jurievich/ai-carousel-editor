import { existsSync, readdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const cwd = process.cwd();
const devDistDirName = ".next-dev";
const nextDir = path.join(cwd, devDistDirName);

if (existsSync(nextDir)) {
  const staleDir = path.join(cwd, `${devDistDirName}_stale_${Date.now()}`);
  try {
    renameSync(nextDir, staleDir);
  } catch {
    // If rename fails, Next can still recreate files in place.
  }
}

const staleDirs = readdirSync(cwd)
  .filter((name) => /^\.next-dev_(stale|corrupt)_\d+/.test(name))
  .sort((left, right) => {
    const leftStamp = Number(left.split("_").pop() || "0");
    const rightStamp = Number(right.split("_").pop() || "0");
    return rightStamp - leftStamp;
  });

for (const dirName of staleDirs.slice(3)) {
  try {
    rmSync(path.join(cwd, dirName), { recursive: true, force: true });
  } catch {
    // Keep startup resilient even if filesystem blocks cleanup.
  }
}

const nextBin = path.join(
  cwd,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "next.cmd" : "next"
);
const args = ["dev", ...process.argv.slice(2)];
const child = spawn(nextBin, args, {
  cwd,
  stdio: "inherit",
  env: process.env
});

child.on("close", (code) => {
  process.exit(code ?? 0);
});
