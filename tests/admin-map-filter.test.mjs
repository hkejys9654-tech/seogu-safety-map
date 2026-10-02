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

assert.match(html, /data-map-filter="all"[^>]*aria-pressed="true"/);
assert.match(script, /mapFilter:\s*"all"/);
assert.match(script, /renderAdmin\(\{ preserveViewport: true \}\)/);
assert.match(script, /getLineFeatures\(dong\)\.filter\(featureMatchesMapFilter\)/);
assert.match(script, /\["all", "report"\]\.includes\(state\.mapFilter\)/);
assert.match(script, /feature\.type === "alley" && feature\.geometry === "line"/);
assert.match(script, /feature\.type === "alley" && feature\.geometry === "point"/);
assert.match(styles, /\.admin-map-filters \.legend-filter\.is-active/);

console.log("Admin map legend filter checks passed");
