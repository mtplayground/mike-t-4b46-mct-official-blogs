import assert from "node:assert/strict";
import test from "node:test";

import { getRustPostList, RustApiRequestError } from "../lib/api/rust-blog";

type FetchMock = typeof globalThis.fetch;

const originalFetch = globalThis.fetch;
const originalRustApiBaseUrl = process.env.RUST_API_BASE_URL;
const originalConsoleError = console.error;

function restoreGlobals() {
  globalThis.fetch = originalFetch;
  if (originalRustApiBaseUrl === undefined) {
    delete process.env.RUST_API_BASE_URL;
  } else {
    process.env.RUST_API_BASE_URL = originalRustApiBaseUrl;
  }
  console.error = originalConsoleError;
}

test.afterEach(restoreGlobals);

test("getRustPostList returns a genuinely empty archive without logging an API error", async () => {
  const errors: unknown[][] = [];
  process.env.RUST_API_BASE_URL = "https://rust-api.example.test";
  console.error = (...args: unknown[]) => {
    errors.push(args);
  };
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ heroPost: null, posts: [] }), {
      headers: { "content-type": "application/json" },
      status: 200,
    })) as FetchMock;

  const postList = await getRustPostList();

  assert.deepEqual(postList, { heroPost: null, posts: [] });
  assert.deepEqual(errors, []);
});

test("getRustPostList logs and throws for non-OK Rust API responses", async () => {
  const errors: unknown[][] = [];
  process.env.RUST_API_BASE_URL = "https://rust-api.example.test";
  console.error = (...args: unknown[]) => {
    errors.push(args);
  };
  globalThis.fetch = (async () =>
    new Response("database unavailable", { status: 500 })) as FetchMock;

  await assert.rejects(getRustPostList, (error: unknown) => {
    assert.ok(error instanceof RustApiRequestError);
    assert.equal(error.path, "/api/posts");
    assert.equal(error.status, 500);
    assert.equal(error.body, "database unavailable");
    return true;
  });

  assert.equal(errors[0]?.[0], "Rust API request failed");
  assert.deepEqual(errors[0]?.[1], {
    body: "database unavailable",
    path: "/api/posts",
    status: 500,
  });
});

test("getRustPostList logs and throws when the Rust API fetch fails before a response", async () => {
  const errors: unknown[][] = [];
  process.env.RUST_API_BASE_URL = "https://rust-api.example.test";
  console.error = (...args: unknown[]) => {
    errors.push(args);
  };
  globalThis.fetch = (async () => {
    throw new Error("connection refused");
  }) as FetchMock;

  await assert.rejects(getRustPostList, (error: unknown) => {
    assert.ok(error instanceof RustApiRequestError);
    assert.equal(error.path, "/api/posts");
    assert.equal(error.status, undefined);
    assert.match(error.message, /failed before response/u);
    return true;
  });

  assert.equal(errors[0]?.[0], "Rust API request failed before response");
  assert.equal((errors[0]?.[1] as { path?: string } | undefined)?.path, "/api/posts");
});
