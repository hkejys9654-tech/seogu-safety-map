import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("배포 결과와 두 화면이 만들어진다", async () => {
  await access(new URL("../dist/server/index.js", import.meta.url));
  await access(new URL("../dist/.openai/hosting.json", import.meta.url));
  const [page, family, admin, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/FamilyApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AdminApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /함께가정/);
  assert.match(family, /우리 가족이 이번 30일 동안 바꿔보고 싶은 점/);
  assert.match(family, /sticky-card-actions/);
  assert.match(admin, /가족별 관리/);
  assert.match(admin, /함께카드 100장/);
  assert.match(layout, /lang="ko"/);
  assert.doesNotMatch(page + family + admin + layout, /[媛숈繹愿]/);
});

test("확정 함께카드가 100장이고 영역별 수가 맞다", async () => {
  const cards = JSON.parse(await readFile(new URL("../app/cards.json", import.meta.url), "utf8"));
  assert.equal(cards.length, 100);
  const counts = Object.groupBy(cards, (card) => card.category);
  assert.deepEqual(
    Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, value.length])),
    { 살림: 26, 관리: 15, 아이돌봄: 20, 아이교육: 18, 가족돌봄: 19, 우리집카드: 2 },
  );
});
