import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  adminCredentialsMatch,
  createAdminSession,
  credentialsMatch,
  verifyAdminSession,
} from "../lib/admin/session";

test("credentialsMatch accepts exact admin credentials", () => {
  assert.equal(credentialsMatch("editor", "editor"), true);
});

test("credentialsMatch rejects wrong or length-mismatched credentials", () => {
  assert.equal(credentialsMatch("editor", "publisher"), false);
  assert.equal(credentialsMatch("editor", "editorial"), false);
});

test("adminCredentialsMatch trims submitted and configured password whitespace", () => {
  assert.equal(
    adminCredentialsMatch(
      { username: " editor ", password: "  correct horse battery staple\n" },
      { username: "editor", password: "correct horse battery staple  " },
    ),
    true,
  );
});

test("adminCredentialsMatch rejects genuinely wrong passwords after trimming", () => {
  assert.equal(
    adminCredentialsMatch(
      { username: "editor", password: "wrong horse battery staple" },
      { username: "editor", password: "correct horse battery staple  " },
    ),
    false,
  );
});

test("admin sessions verify with the same secret", async () => {
  const now = 1_700_000_000_000;
  const session = await createAdminSession("test-secret", now);
  const originalDateNow = Date.now;

  try {
    Date.now = () => now;

    assert.equal(await verifyAdminSession(session, "test-secret"), true);
  } finally {
    Date.now = originalDateNow;
  }
});

test("admin sessions reject tampering, missing secrets, and expiration", async () => {
  const now = 1_700_000_000_000;
  const session = await createAdminSession("test-secret", now);
  const tamperedSession = session.replace("v1.", "v1x.");
  const expiredSession = await createAdminSession(
    "test-secret",
    now - ADMIN_SESSION_MAX_AGE_SECONDS * 1000 - 1,
  );
  const originalDateNow = Date.now;

  try {
    Date.now = () => now;

    assert.equal(await verifyAdminSession(tamperedSession, "test-secret"), false);
    assert.equal(await verifyAdminSession(session, undefined), false);
    assert.equal(await verifyAdminSession(expiredSession, "test-secret"), false);
  } finally {
    Date.now = originalDateNow;
  }
});

async function withAdminEnv<T>(
  env: Record<string, string | undefined>,
  callback: () => Promise<T> | T,
) {
  const previous = new Map<string, string | undefined>();
  const { resetServerEnvCacheForTests } = await import("../lib/env/server");

  for (const key of Object.keys(env)) {
    previous.set(key, process.env[key]);
    if (env[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = env[key];
    }
  }

  resetServerEnvCacheForTests();

  try {
    return await callback();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    resetServerEnvCacheForTests();
  }
}

test("proxy verifies sessions signed with fallback-derived admin credentials", async () => {
  await withAdminEnv(
    {
      ADMIN_USERNAME: undefined,
      ADMIN_PASSWORD: undefined,
      JWT_SECRET: "fallback-secret-for-proxy",
    },
    async () => {
      const { getAdminCredentials } = await import("../lib/env/server");
      const { proxy } = await import("../proxy");
      const { NextRequest } = await import("next/server");
      const now = 1_700_000_000_000;
      const credentials = getAdminCredentials();
      const session = await createAdminSession(credentials.password, now);
      const originalDateNow = Date.now;

      try {
        Date.now = () => now;

        const request = new NextRequest("https://example.test/admin", {
          headers: {
            cookie: `${ADMIN_SESSION_COOKIE}=${session}`,
          },
        });
        const response = await proxy(request);

        assert.equal(response.headers.get("location"), null);
      } finally {
        Date.now = originalDateNow;
      }
    },
  );
});

test("admin credential validation rejects partial explicit env configuration", async () => {
  await withAdminEnv(
    {
      ADMIN_USERNAME: "admin_only",
      ADMIN_PASSWORD: undefined,
      JWT_SECRET: "fallback-secret-for-partial-env",
    },
    async () => {
      const { getAdminCredentials } = await import("../lib/env/server");

      assert.throws(
        () => getAdminCredentials(),
        /ADMIN_USERNAME and ADMIN_PASSWORD must be configured together\./,
      );
    },
  );
});
