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
const jwtSecret =
  process.env.JWT_SECRET ?? productionEnv.JWT_SECRET ?? "playwright-test-jwt-secret";
const objectStorageKeys = [
  "OBJECT_STORAGE_ACCESS_KEY_ID",
  "OBJECT_STORAGE_SECRET_ACCESS_KEY",
  "OBJECT_STORAGE_BUCKET",
  "OBJECT_STORAGE_PREFIX",
  "OBJECT_STORAGE_ENDPOINT",
  "OBJECT_STORAGE_REGION",
  "OBJECT_STORAGE_FORCE_PATH_STYLE",
] as const;
const objectStorageConfigured = objectStorageKeys.every((key) =>
  Boolean(process.env[key] ?? productionEnv[key]),
);
const uploadE2eEnabled = objectStorageConfigured && process.env.RUN_UPLOAD_E2E === "1";
const objectStorageEnv = {
  OBJECT_STORAGE_ACCESS_KEY_ID:
    process.env.OBJECT_STORAGE_ACCESS_KEY_ID ??
    productionEnv.OBJECT_STORAGE_ACCESS_KEY_ID ??
    "test-access-key",
  OBJECT_STORAGE_SECRET_ACCESS_KEY:
    process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY ??
    productionEnv.OBJECT_STORAGE_SECRET_ACCESS_KEY ??
    "test-secret-key",
  OBJECT_STORAGE_BUCKET:
    process.env.OBJECT_STORAGE_BUCKET ?? productionEnv.OBJECT_STORAGE_BUCKET ?? "test-bucket",
  OBJECT_STORAGE_PREFIX:
    process.env.OBJECT_STORAGE_PREFIX ?? productionEnv.OBJECT_STORAGE_PREFIX ?? "playwright-test/",
  OBJECT_STORAGE_ENDPOINT:
    process.env.OBJECT_STORAGE_ENDPOINT ??
    productionEnv.OBJECT_STORAGE_ENDPOINT ??
    "https://storage.example.com",
  OBJECT_STORAGE_REGION:
    process.env.OBJECT_STORAGE_REGION ?? productionEnv.OBJECT_STORAGE_REGION ?? "auto",
  OBJECT_STORAGE_FORCE_PATH_STYLE:
    process.env.OBJECT_STORAGE_FORCE_PATH_STYLE ??
    productionEnv.OBJECT_STORAGE_FORCE_PATH_STYLE ??
    "true",
};

if (!databaseUrl) {
  throw new Error("DATABASE_URL or /workspace/.database_url is required to run E2E tests.");
}

process.env.DATABASE_URL = databaseUrl;
process.env.SELF_URL = process.env.SELF_URL ?? baseURL;
process.env.ADMIN_USERNAME = adminUsername;
process.env.ADMIN_PASSWORD = adminPassword;
process.env.JWT_SECRET = jwtSecret;
Object.assign(process.env, objectStorageEnv);

export default defineConfig({
  testDir: "./e2e",
  metadata: {
    adminPassword,
    adminUsername,
    objectStorageConfigured,
    uploadE2eEnabled,
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
    command: "npm run dev",
    env: {
      ...process.env,
      ...productionEnv,
      ...objectStorageEnv,
      ADMIN_PASSWORD: adminPassword,
      ADMIN_USERNAME: adminUsername,
      JWT_SECRET: jwtSecret,
      DATABASE_URL: databaseUrl,
      SELF_URL: baseURL,
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: `${baseURL}/health`,
  },
});
