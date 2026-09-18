import assert from "node:assert/strict";

let tileAdded = false;
const fakeLeafletMap = { id: "fallback-map" };

globalThis.window = globalThis;
globalThis.SAFETY_MAP_RUNTIME_CONFIG = { kakaoJavaScriptKey: "" };
globalThis.document = {
  querySelector() { return null; },
  createElement(tagName) { return { tagName, dataset: {}, addEventListener() {} }; },
  head: {
    appendChild(element) {
      if (element.tagName !== "script") return;
      globalThis.L = {
        map() { return fakeLeafletMap; },
        tileLayer() {
          return { addTo(map) { tileAdded = map === fakeLeafletMap; } };
        },
        layerGroup() { return {}; }
      };
      queueMicrotask(() => element.onload());
    }
  }
};

await import("../kakao-map.js");
await globalThis.SafetyMapKakaoReady;

assert.equal(globalThis.SAFETY_MAP_PROVIDER, "openstreetmap-fallback");
assert.equal(globalThis.KMap.map("test"), fakeLeafletMap);
assert.equal(tileAdded, true);
console.log("Kakao map fallback test passed");
