import { existsSync, readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

function readEnvFile(path: string) {
  if (!existsSync(path)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        const key = line.slice(0, separatorIndex);
        const value = line.slice(separatorIndex + 1).replace(/^["']|["']$/g, "");

        return [key, value];
      }),
  );
}

function readSecretFile(path: string) {
  return existsSync(path) ? readFileSync(path, "utf8").trim() : undefined;
}

const productionEnv = readEnvFile(".env.production");
const databaseUrl =
  process.env.DATABASE_URL ?? readSecretFile(".database_url") ?? productionEnv.DATABASE_URL;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8080";
const adminUsername = process.env.ADMIN_USERNAME ?? productionEnv.ADMIN_USERNAME ?? "e2e-admin";
const adminPassword =
  process.env.ADMIN_PASSWORD ?? productionEnv.ADMIN_PASSWORD ?? "e2e-admin-password";

if (!databaseUrl) {
  throw new Error("DATABASE_URL or /workspace/.database_url is required to run E2E tests.");
}

process.env.DATABASE_URL = databaseUrl;
process.env.SELF_URL = process.env.SELF_URL ?? baseURL;
process.env.ADMIN_USERNAME = adminUsername;
process.env.ADMIN_PASSWORD = adminPassword;

export default defineConfig({
  testDir: "./e2e",
  metadata: {
    adminPassword,
    adminUsername,
  },
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run db:migrate:deploy && npm run dev",
    env: {
      ...process.env,
      ...productionEnv,
      ADMIN_PASSWORD: adminPassword,
      ADMIN_USERNAME: adminUsername,
      DATABASE_URL: databaseUrl,
      SELF_URL: baseURL,
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: baseURL,
  },
});
