import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [index, citizen, admin, adminScript, rules, service, build] = await Promise.all([
  read("index.html"),
  read("hamkke/hamkke-citizen.js"),
  read("admin/hamkke.html"),
  read("admin/hamkke.js"),
  read("firestore.rules"),
  read("firebase-service.js"),
  read("scripts/build-site.ps1")
]);

// 시민참여단: 하단 탭 두 개와 함께가게 화면
assert.match(index, /data-tab="map"/);
assert.match(index, /data-tab="hamkke"/);
assert.match(index, /id="hamkke-view"/);
assert.match(index, /hamkke\/hamkke-citizen\.js/);
assert.doesNotMatch(index, /id="report-note"[^>]*required/);
assert.match(citizen, /safetymap:tabchange/);

// 관리자: 한글·엑셀 내려받기
assert.match(admin, /hamkke\/vendor\/jszip\.min\.js/);
assert.match(admin, /hamkke\/hamkke-hwpx\.js/);
assert.match(adminScript, /result-template\.hwpx/);

// 자료 저장소 규칙과 빌드
assert.match(rules, /match \/hamkkeVault\/\{code\}/);
assert.match(rules, /allow list, delete: if false;/);
assert.match(service, /saveHamkkeSection/);
assert.match(build, /"hamkke"/);

const template = await stat(new URL("../hamkke/result-template.hwpx", import.meta.url));
assert.ok(template.size > 10000);

console.log("hamkke static checks passed");

// 2026-10-21: 캠페인 1차 토글과 상호명 기준 결과 연결
const core = await read("hamkke/hamkke-core.js");
assert.match(citizen, /data-hk="campaign-only"/);
assert.match(citizen, /campaignOnly: true/);
assert.match(core, /function indexResults/);
assert.match(rules, /'campaign', 'frame', 'note'/);
console.log("hamkke campaign checks passed");

// 2026-10-30: 결과 입력 맨 위 현장 사진
const form = await read("hamkke/hamkke-form.js");
assert.match(index, /hamkke\/hamkke-photos\.js/);
assert.match(admin, /hamkke\/hamkke-photos\.js/);
assert.ok(form.indexOf('class="hk-photos"') < form.indexOf('data-hk-panel="visit"'));
assert.match(rules, /match \/photos\/\{photoId\}/);
assert.match(rules, /'photoCount'/);
console.log("hamkke photo checks passed");
