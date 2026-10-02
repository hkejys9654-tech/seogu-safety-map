import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, script, styles] = await Promise.all([
  readFile(new URL("../admin/index.html", import.meta.url), "utf8"),
  readFile(new URL("../admin/app.js", import.meta.url), "utf8"),
  readFile(new URL("../admin/admin.css", import.meta.url), "utf8")
]);

for (const filter of ["all", "return", "alley-line", "alley-point", "parcel", "vending", "report"]) {
  assert.match(html, new RegExp(`data-map-filter="${filter}"`));
}

assert.equal((html.match(/aria-pressed="true"/g) || []).length, 7);
assert.match(script, /mapFilters:\s*new Set\(MAP_FILTERS\)/);
assert.match(script, /state\.mapFilters = allVisible \? new Set\(\) : new Set\(MAP_FILTERS\)/);
assert.match(script, /state\.mapFilters\.delete\(requested\)/);
assert.match(script, /state\.mapFilters\.add\(requested\)/);
assert.match(script, /renderAdmin\(\{ preserveViewport: true \}\)/);
assert.match(script, /getLineFeatures\(dong\)\.filter\(featureMatchesMapFilter\)/);
assert.match(script, /state\.mapFilters\.has\("report"\)/);
assert.match(script, /`alley-\$\{feature\.geometry\}`/);
assert.match(script, /aria-pressed", requested === "all" && someVisible \? "mixed"/);
assert.match(styles, /\.admin-map-filters \.legend-filter\.is-active/);
assert.match(styles, /\.admin-map-filters \.legend-filter\.is-partial/);

console.log("Admin map legend filter checks passed");
