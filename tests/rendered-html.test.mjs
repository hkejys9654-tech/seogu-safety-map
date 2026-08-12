import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("build contains the Cloudflare worker entry", async () => {
  await access(new URL("../dist/server/index.js", import.meta.url));
  await access(new URL("../dist/.openai/hosting.json", import.meta.url));
});

test("family and admin products replace the starter", async () => {
  const [page, family, admin, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/FamilyApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AdminApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /FamilyApp/);
  assert.match(family, /가정번호/);
  assert.match(family, /반반한 가정/);
  assert.match(family, /haeoni-yellow/);
  assert.match(admin, /관리자 화면/);
  assert.match(layout, /lang="ko"/);
  assert.doesNotMatch(page + family + admin + packageJson, /codex-preview|react-loading-skeleton|SkeletonPreview/);
});
