let cachedSelfUrl: string | undefined;

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function requiredUrlEnv(name: string) {
  const value = requiredEnv(name);
  try {
    new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }
  return value;
}

export function getSelfUrl() {
  cachedSelfUrl ??= requiredUrlEnv("SELF_URL");
  return cachedSelfUrl;
}

export function resetServerEnvCacheForTests() {
  cachedSelfUrl = undefined;
}

export function getRequiredServerEnv() {
  return {
    selfUrl: getSelfUrl(),
    rustApiBaseUrl: process.env.RUST_API_BASE_URL || undefined,
  };
}
