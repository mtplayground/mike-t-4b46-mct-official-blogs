import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routePath = new URL("../app/api/revalidate/route.ts", import.meta.url);
const nextConfigPath = new URL("../next.config.ts", import.meta.url);

test("revalidation route is guarded and refreshes public listing and article paths", async () => {
  const source = await readFile(routePath, "utf8");

  assert.match(source, /process\.env\.REVALIDATE_SECRET|process\.env\.JWT_SECRET/);
  assert.match(source, /bearerToken\(request\) !== secret/);
  assert.match(source, /revalidatePath\("\/"\)/);
  assert.match(source, /revalidatePath\("\/blog\/\[slug\]", "page"\)/);
  assert.match(source, /revalidatePath\(`\/blog\/\$\{slug\}`\)/);
  assert.match(source, /\/blog\/category\/thoughts/);
});

test("Next rewrites leave the local revalidation route on Next before proxying API fallback to Rust", async () => {
  const source = await readFile(nextConfigPath, "utf8");

  assert.match(source, /fallback:\s*\[/);
  assert.match(source, /source:\s*"\/api\/:path\*"/);
  assert.match(source, /destination:\s*`\$\{rustApiBaseUrl\.replace/);
});
