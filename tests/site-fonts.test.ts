import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sansOnlyFiles = [
  "app/globals.css",
  "app/(public)/page.tsx",
  "app/(public)/blog/[slug]/page.tsx",
  "components/layout/site-header.tsx",
  "components/layout/site-footer.tsx",
];

test("Tailwind exposes only the editorial sans font family token", async () => {
  const source = await readFile("tailwind.config.ts", "utf8");

  assert.match(source, /sans:\s*\["Arial",\s*"Helvetica Neue",\s*"Helvetica",\s*"sans-serif"\]/);
  assert.doesNotMatch(source, /display:\s*\[/);
  assert.doesNotMatch(source, /Georgia|Times New Roman/);
});

test("global typography defaults headings and body copy to sans", async () => {
  const source = await readFile("app/globals.css", "utf8");

  assert.match(source, /@apply bg-editorial-white font-sans text-editorial-ink antialiased;/);
  assert.match(source, /@apply m-0 font-sans font-semibold text-editorial-ink;/);
});

test("public pages and layout components do not opt into a display font", async () => {
  for (const file of sansOnlyFiles) {
    const source = await readFile(file, "utf8");

    assert.doesNotMatch(source, /font-display/, `${file} should use the sans font stack`);
  }
});
