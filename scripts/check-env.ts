import { getRequiredServerEnv } from "../lib/env/server";

try {
  const env = getRequiredServerEnv();
  console.log(
    JSON.stringify({
      ok: true,
      selfUrl: env.selfUrl,
      rustApiBaseUrl: env.rustApiBaseUrl ?? null,
    }),
  );
} catch (error) {
  console.error(error);
  process.exit(1);
}
