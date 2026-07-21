#!/usr/bin/env node
/**
 * Прописывает ключи нового Supabase-проекта в .env.local и Vercel (production).
 *
 * Зачем: старый Supabase-проект приложения не существует (NXDOMAIN), из-за чего
 * логин/регистрация/кредиты/проекты не работают. После создания нового проекта
 * на supabase.com этот скрипт синхронизирует окружения за один запуск.
 *
 * Использование:
 *   node scripts/setup-supabase-env.mjs \
 *     --url https://<ref>.supabase.co \
 *     --anon <NEXT_PUBLIC_SUPABASE_ANON_KEY> \
 *     --service <SUPABASE_SERVICE_ROLE_KEY>
 *
 * После скрипта: применить supabase/schema.sql в SQL Editor проекта
 * и задеплоить (npx vercel --prod --yes).
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : "";
  if (!value || value.startsWith("--")) {
    console.error(`Missing --${name}`);
    process.exit(1);
  }
  return value.trim();
}

const url = arg("url");
const anon = arg("anon");
const service = arg("service");

if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) {
  console.error(`URL looks wrong: ${url} (expected https://<ref>.supabase.co)`);
  process.exit(1);
}

// 1. .env.local
const envPath = path.resolve(".env.local");
const pairs = {
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
  SUPABASE_SERVICE_ROLE_KEY: service
};
let env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
for (const [key, value] of Object.entries(pairs)) {
  const line = `${key}=${value}`;
  env = new RegExp(`^${key}=`, "m").test(env)
    ? env.replace(new RegExp(`^${key}=.*$`, "m"), line)
    : `${env.trimEnd()}\n${line}\n`;
}
writeFileSync(envPath, env.endsWith("\n") ? env : `${env}\n`);
console.log("✓ .env.local updated");

// 2. Vercel production env (rm может падать, если переменной нет — это ок)
for (const [key, value] of Object.entries(pairs)) {
  try {
    execSync(`npx vercel env rm ${key} production --yes`, { stdio: "pipe" });
  } catch {
    /* not set yet */
  }
  execSync(`npx vercel env add ${key} production`, { input: value, stdio: ["pipe", "inherit", "inherit"] });
  console.log(`✓ Vercel production: ${key}`);
}

console.log("\nДальше:");
console.log("1. Supabase Dashboard → SQL Editor → вставить содержимое supabase/schema.sql → Run");
console.log("2. npx vercel --prod --yes");
