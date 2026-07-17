import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";

const forbiddenPaths = [
  "app",
  "components",
  "lib/api/rust-blog.ts",
  "next.config.ts",
  "next-env.d.ts",
  "proxy.ts",
  "deploy-proxy.mjs",
];

for (const path of forbiddenPaths) {
  assert.equal(existsSync(path), false, `${path} should not exist after removing the Next.js runtime`);
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const dependencyMaps = [pkg.dependencies ?? {}, pkg.devDependencies ?? {}, pkg.optionalDependencies ?? {}];
const forbiddenPackages = [
  "next",
  "react",
  "react-dom",
  "react-markdown",
  "remark-gfm",
  "eslint-config-next",
  "@types/react",
  "@types/react-dom",
];

for (const dependency of forbiddenPackages) {
  assert.equal(
    dependencyMaps.some((map) => Object.hasOwn(map, dependency)),
    false,
    `${dependency} should not be installed after removing the Next.js runtime`,
  );
}

console.log("Next.js runtime dependencies removed.");
