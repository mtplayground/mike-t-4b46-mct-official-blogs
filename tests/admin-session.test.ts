import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMIN_SESSION_MAX_AGE_SECONDS,
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
