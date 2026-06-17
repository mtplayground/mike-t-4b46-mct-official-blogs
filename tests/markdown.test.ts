import assert from "node:assert/strict";
import test from "node:test";

import { getSignedMarkdownBody, type MarkdownImageSigner } from "../lib/content/markdown";

test("getSignedMarkdownBody leaves plain Markdown unchanged", async () => {
  const body = [
    "## Field notes",
    "",
    "Plain Markdown with **strong emphasis**, a [link](https://example.com), and no storage images.",
  ].join("\n");
  const seenKeys: string[] = [];

  const result = await getSignedMarkdownBody(body, async (key) => {
    seenKeys.push(key);
    return `https://signed.example/${key}`;
  });

  assert.equal(result, body);
  assert.deepEqual(seenKeys, []);
});

test("getSignedMarkdownBody replaces a single storage image with a signed URL", async () => {
  const body = "Intro paragraph.\n\n![Cover](storage:post-images/2026/06/cover.png)";

  const result = await getSignedMarkdownBody(
    body,
    async (key) => `https://signed.example.com/read/${encodeURIComponent(key)}`,
  );

  assert.equal(
    result,
    "Intro paragraph.\n\n![Cover](https://signed.example.com/read/post-images%2F2026%2F06%2Fcover.png)",
  );
});

test("getSignedMarkdownBody replaces multiple storage images", async () => {
  const signedUrls = new Map([
    ["post-images/2026/06/first.png", "https://signed.example.com/first"],
    ["post-images/2026/06/second.webp", "https://signed.example.com/second"],
  ]);
  const seenKeys: string[] = [];
  const signer: MarkdownImageSigner = async (key) => {
    seenKeys.push(key);
    const signedUrl = signedUrls.get(key);

    if (!signedUrl) {
      throw new Error(`Unexpected key: ${key}`);
    }

    return signedUrl;
  };

  const result = await getSignedMarkdownBody(
    "![First](storage:post-images/2026/06/first.png)\n\nCopy between images.\n\n![Second](storage:post-images/2026/06/second.webp)",
    signer,
  );

  assert.equal(
    result,
    "![First](https://signed.example.com/first)\n\nCopy between images.\n\n![Second](https://signed.example.com/second)",
  );
  assert.deepEqual(seenKeys, ["post-images/2026/06/first.png", "post-images/2026/06/second.webp"]);
});

test("getSignedMarkdownBody leaves failed storage references unchanged and continues", async () => {
  const originalConsoleError = console.error;
  const loggedErrors: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    loggedErrors.push(args);
  };

  try {
    const result = await getSignedMarkdownBody(
      "![Good](storage:post-images/2026/06/good.png)\n\n![Broken](storage:post-images/2026/06/broken.png)",
      async (key) => {
        if (key.includes("broken")) {
          throw new Error("signing unavailable");
        }

        return `https://signed.example.com/${key}`;
      },
    );

    assert.equal(
      result,
      "![Good](https://signed.example.com/post-images/2026/06/good.png)\n\n![Broken](storage:post-images/2026/06/broken.png)",
    );
    assert.equal(loggedErrors.length, 1);
  } finally {
    console.error = originalConsoleError;
  }
});
