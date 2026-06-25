import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import nextConfig from "../next.config";

test("server actions accept multipart post editor uploads up to 25mb", () => {
  assert.deepEqual(nextConfig.experimental?.serverActions, {
    bodySizeLimit: "25mb",
  });
});

test("post editor form submits image fields as multipart form data", async () => {
  const source = await readFile("app/admin/posts/_components/post-editor-form.tsx", "utf8");

  assert.match(source, /encType="multipart\/form-data"/);
  assert.match(source, /PostUploadSizeWarning/);
});

test("post editor surfaces a clear client-side message for oversized multipart image selections", async () => {
  const source = await readFile("app/admin/posts/_components/post-upload-size-warning.tsx", "utf8");

  assert.match(source, /MAX_MULTIPART_UPLOAD_BYTES = 25 \* MEGABYTE/);
  assert.match(source, /Keep combined image uploads under 25 MB and try again/);
});
