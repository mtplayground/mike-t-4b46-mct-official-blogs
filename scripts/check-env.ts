import { getRequiredServerEnv } from "../lib/env/server";

function mask(value: string) {
  if (value.length <= 8) {
    return "configured";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

try {
  const env = getRequiredServerEnv();

  console.log("Environment check passed.");
  console.log(`SELF_URL=${env.selfUrl}`);
  console.log(`DATABASE_URL=${mask(env.databaseUrl)}`);
  console.log(`ADMIN_USERNAME=${env.admin.username}`);
  console.log(`OBJECT_STORAGE_BUCKET=${env.objectStorage.bucket}`);
  console.log(`OBJECT_STORAGE_PREFIX=${env.objectStorage.prefix}`);
  console.log(`OBJECT_STORAGE_ENDPOINT=${env.objectStorage.endpoint}`);
} catch (error) {
  console.error("Environment check failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
