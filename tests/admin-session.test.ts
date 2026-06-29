import assert from "node:assert/strict";
import test from "node:test";

const ADMIN_SESSION_COOKIE = "mct_admin_session";

test("proxy allows admin login page without Rust verification", async () => {
  const { proxy } = await import("../proxy");
  const { NextRequest } = await import("next/server");
  const request = new NextRequest("https://example.test/admin/login");
  const response = await proxy(request);

  assert.equal(response.headers.get("location"), null);
});

test("proxy redirects protected admin routes when Rust verification is unavailable", async () => {
  const { proxy } = await import("../proxy");
  const { NextRequest } = await import("next/server");
  const request = new NextRequest("https://example.test/admin?tab=posts", {
    headers: { cookie: `${ADMIN_SESSION_COOKIE}=invalid` },
  });
  const response = await proxy(request);
  const location = response.headers.get("location") || "";

  assert.match(location, /\/admin\/login/);
  assert.match(location, /next=%2Fadmin%3Ftab%3Dposts/);
});

async function withSelfUrl<T>(value: string | undefined, callback: () => Promise<T> | T) {
  const previous = process.env.SELF_URL;
  const { resetServerEnvCacheForTests } = await import("../lib/env/server");
  if (value === undefined) delete process.env.SELF_URL;
  else process.env.SELF_URL = value;
  resetServerEnvCacheForTests();
  try {
    return await callback();
  } finally {
    if (previous === undefined) delete process.env.SELF_URL;
    else process.env.SELF_URL = previous;
    resetServerEnvCacheForTests();
  }
}

test("server env keeps SELF_URL validation for frontend canonical URLs", async () => {
  await withSelfUrl("https://blog.example.com", async () => {
    const { getSelfUrl } = await import("../lib/env/server");
    assert.equal(getSelfUrl(), "https://blog.example.com");
  });

  await withSelfUrl(undefined, async () => {
    const { getSelfUrl } = await import("../lib/env/server");
    assert.throws(() => getSelfUrl(), /SELF_URL is required/);
  });
});
