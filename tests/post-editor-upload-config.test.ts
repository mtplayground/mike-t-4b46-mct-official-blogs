import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("post editor form submits directly to Rust multipart endpoints", async () => {
  const source = await readFile("app/admin/posts/_components/post-editor-form.tsx", "utf8");

  assert.match(source, /encType="multipart\/form-data"/);
  assert.match(source, /method="post"/);
  assert.match(source, /\/api\/admin\/posts/);
  assert.match(source, /PostUploadSizeWarning/);
  assert.match(source, /name="coverImage"/);
  assert.match(source, /name="squareCoverImage"/);
  assert.doesNotMatch(source, /CoverImageCropper/);
});

test("Rust admin CMS handles multipart image storage and cleanup", async () => {
  const source = await readFile("rust-backend/src/posts/admin.rs", "utf8");

  assert.match(source, /MAX_IMAGE_BYTES: usize = 10 \* 1024 \* 1024/);
  assert.match(source, /post-images\/{}\/\{:02\}\/{}\.\{}/);
  assert.match(source, /storage\s*\.\s*put_object/);
  assert.match(source, /Content-Length|content_length|body\.len\(\)/);
  assert.match(source, /cleanup_uploaded/);
  assert.match(source, /delete_object/);
});

test("admin post deletion posts to Rust delete endpoint", async () => {
  const source = await readFile("app/admin/page.tsx", "utf8");

  assert.match(source, /\/api\/admin\/posts\/\$\{post\.id\}\/delete/);
  assert.match(source, /method="post"/);
});

test("post editor surfaces a clear client-side message for oversized multipart image selections", async () => {
  const source = await readFile("app/admin/posts/_components/post-upload-size-warning.tsx", "utf8");

  assert.match(source, /MAX_MULTIPART_UPLOAD_BYTES = 50 \* MEGABYTE/);
  assert.match(source, /"squareCoverImage"/);
  assert.match(source, /Keep combined image uploads under 50 MB and try again/);
});
