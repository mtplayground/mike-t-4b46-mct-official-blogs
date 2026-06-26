import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import nextConfig from "../next.config";

test("server actions accept multipart post editor uploads up to 50mb", () => {
  assert.deepEqual(nextConfig.experimental?.serverActions, {
    bodySizeLimit: "50mb",
  });
});

test("post editor form submits image fields as multipart form data", async () => {
  const source = await readFile("app/admin/posts/_components/post-editor-form.tsx", "utf8");

  assert.match(source, /encType="multipart\/form-data"/);
  assert.match(source, /PostUploadSizeWarning/);
  assert.match(source, /Cover image, 16:9/);
  assert.match(source, /name="coverImage"/);
  assert.match(source, /Square cover image, 1:1/);
  assert.match(source, /name="squareCoverImage"/);
  assert.doesNotMatch(source, /CoverImageCropper/);
});

test("post server actions upload and persist both cover image keys", async () => {
  const source = await readFile("app/admin/posts/actions.ts", "utf8");

  assert.match(source, /getOptionalFile\(formData, "coverImage"\)/);
  assert.match(source, /getOptionalFile\(formData, "squareCoverImage"\)/);
  assert.match(source, /squareCoverImageKey/);
  assert.match(source, /uploadedSquareCover = await uploadImageFile\(squareCoverImage\)/);
  assert.match(source, /nextSquareCoverImageKey = uploadedSquareCover\.key/);
  assert.match(source, /deletePostImage\(oldSquareCoverKey\)/);
});

test("admin post deletion cleans up the square cover image object", async () => {
  const source = await readFile("app/admin/actions.ts", "utf8");

  assert.match(source, /squareCoverImageKey: true/);
  assert.match(source, /deletePostImage\(existingPost\.squareCoverImageKey\)/);
});

test("post editor surfaces a clear client-side message for oversized multipart image selections", async () => {
  const source = await readFile("app/admin/posts/_components/post-upload-size-warning.tsx", "utf8");

  assert.match(source, /MAX_MULTIPART_UPLOAD_BYTES = 50 \* MEGABYTE/);
  assert.match(source, /"squareCoverImage"/);
  assert.match(source, /Keep combined image uploads under 50 MB and try again/);
});
