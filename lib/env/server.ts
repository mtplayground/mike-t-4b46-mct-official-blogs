export type AdminCredentials = {
  username: string;
  password: string;
};

export type ObjectStorageEnv = {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  prefix: string;
  endpoint: string;
  region: string;
  forcePathStyle: boolean;
};

export type RequiredServerEnv = {
  databaseUrl: string;
  selfUrl: string;
  admin: AdminCredentials;
  objectStorage: ObjectStorageEnv;
};

let cachedDatabaseUrl: string | undefined;
let cachedSelfUrl: string | undefined;
let cachedAdminCredentials: AdminCredentials | undefined;
let cachedObjectStorageEnv: ObjectStorageEnv | undefined;

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required.`);
  }

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

function requiredBooleanEnv(name: string) {
  const value = requiredEnv(name);

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`${name} must be either true or false.`);
}

export function getDatabaseUrl() {
  cachedDatabaseUrl ??= requiredUrlEnv("DATABASE_URL");
  return cachedDatabaseUrl;
}

export function getSelfUrl() {
  cachedSelfUrl ??= requiredUrlEnv("SELF_URL");
  return cachedSelfUrl;
}

export function getAdminCredentials(): AdminCredentials {
  cachedAdminCredentials ??= {
    username: requiredEnv("ADMIN_USERNAME"),
    password: requiredEnv("ADMIN_PASSWORD"),
  };

  return cachedAdminCredentials;
}

export function getObjectStorageEnv(): ObjectStorageEnv {
  cachedObjectStorageEnv ??= {
    accessKeyId: requiredEnv("OBJECT_STORAGE_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("OBJECT_STORAGE_SECRET_ACCESS_KEY"),
    bucket: requiredEnv("OBJECT_STORAGE_BUCKET"),
    prefix: requiredEnv("OBJECT_STORAGE_PREFIX"),
    endpoint: requiredUrlEnv("OBJECT_STORAGE_ENDPOINT"),
    region: requiredEnv("OBJECT_STORAGE_REGION"),
    forcePathStyle: requiredBooleanEnv("OBJECT_STORAGE_FORCE_PATH_STYLE"),
  };

  if (!cachedObjectStorageEnv.prefix.endsWith("/")) {
    throw new Error("OBJECT_STORAGE_PREFIX must include its trailing slash.");
  }

  return cachedObjectStorageEnv;
}

export function getRequiredServerEnv(): RequiredServerEnv {
  return {
    databaseUrl: getDatabaseUrl(),
    selfUrl: getSelfUrl(),
    admin: getAdminCredentials(),
    objectStorage: getObjectStorageEnv(),
  };
}
