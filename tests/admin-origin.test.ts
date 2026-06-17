import assert from "node:assert/strict";
import test from "node:test";

import { getAdminRedirectOrigin } from "../lib/admin/origin";

const originalNodeEnv = process.env.NODE_ENV;
const originalSelfUrl = process.env.SELF_URL;

test.afterEach(() => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }

  if (originalSelfUrl === undefined) {
    delete process.env.SELF_URL;
  } else {
    process.env.SELF_URL = originalSelfUrl;
  }
});

test("admin redirect origin uses SELF_URL in production", () => {
  process.env.NODE_ENV = "production";
  process.env.SELF_URL = "https://official.example.com/base-path";

  const request = new Request("http://internal.example.test/admin/login", {
    headers: {
      host: "internal.example.test",
      "x-forwarded-proto": "http",
    },
  });

  assert.equal(getAdminRedirectOrigin(request), "https://official.example.com");
});

test("admin redirect origin uses request headers outside production", () => {
  process.env.NODE_ENV = "development";
  process.env.SELF_URL = "https://official.example.com";

  const request = new Request("http://internal.example.test/admin/login", {
    headers: {
      host: "local.example.test:8080",
      "x-forwarded-proto": "http",
    },
  });

  assert.equal(getAdminRedirectOrigin(request), "http://local.example.test:8080");
});
