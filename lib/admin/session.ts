export const ADMIN_SESSION_COOKIE = "mct_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const encoder = new TextEncoder();

function toBase64Url(bytes: ArrayBuffer) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  const base64 =
    typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");

  return base64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function constantTimeEqual(first: string, second: string) {
  const maxLength = Math.max(first.length, second.length);
  let mismatch = first.length === second.length ? 0 : 1;

  for (let index = 0; index < maxLength; index += 1) {
    const firstCode = index < first.length ? first.charCodeAt(index) : 0;
    const secondCode = index < second.length ? second.charCodeAt(index) : 0;

    mismatch |= firstCode ^ secondCode;
  }

  return mismatch === 0;
}

async function signMessage(message: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));

  return toBase64Url(signature);
}

function getSessionMessage(expiresAt: number) {
  return `admin:${expiresAt}`;
}

export async function createAdminSession(secret: string, now = Date.now()) {
  const expiresAt = now + ADMIN_SESSION_MAX_AGE_SECONDS * 1000;
  const signature = await signMessage(getSessionMessage(expiresAt), secret);

  return `v1.${expiresAt}.${signature}`;
}

export async function verifyAdminSession(value: string | undefined, secret: string | undefined) {
  if (!value || !secret) {
    return false;
  }

  const [version, expiresAtValue, signature] = value.split(".");
  const expiresAt = Number.parseInt(expiresAtValue ?? "", 10);

  if (version !== "v1" || !Number.isFinite(expiresAt) || !signature || expiresAt <= Date.now()) {
    return false;
  }

  const expectedSignature = await signMessage(getSessionMessage(expiresAt), secret);

  return constantTimeEqual(signature, expectedSignature);
}

export function credentialsMatch(input: string, expected: string) {
  return constantTimeEqual(input, expected);
}

type AdminCredentialValues = {
  password: string;
  username: string;
};

export function adminCredentialsMatch(
  input: AdminCredentialValues,
  expected: AdminCredentialValues,
) {
  return (
    credentialsMatch(input.username.trim(), expected.username.trim()) &&
    credentialsMatch(input.password.trim(), expected.password.trim())
  );
}
