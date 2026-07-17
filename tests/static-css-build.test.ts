import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Tailwind scans Rust templates and Rust source for server-rendered CSS", async () => {
  const config = await readFile("tailwind.config.ts", "utf8");

  assert.match(config, /\.\/rust-backend\/templates\/\*\*\/\*\.html/);
  assert.match(config, /\.\/rust-backend\/src\/\*\*\/\*\.rs/);
});

test("static CSS build uses the moved Tailwind input and writes the public asset", async () => {
  const script = await readFile("scripts/build-css.sh", "utf8");
  const css = await readFile("public/assets/app.css", "utf8");

  assert.match(script, /assets\/styles\/input\.css/);
  assert.match(script, /public\/assets\/app\.css/);
  assert.match(script, /--minify/);
  assert.match(css, /\.editorial-button/);
  assert.doesNotMatch(css, /\n\s{2,}/, "compiled app.css should be minified");
});
