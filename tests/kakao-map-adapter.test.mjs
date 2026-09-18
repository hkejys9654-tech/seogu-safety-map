import assert from "node:assert/strict";

class FakeClassList {
  constructor() { this.values = new Set(); }
  toggle(name, force) {
    if (force === false) this.values.delete(name);
    else this.values.add(name);
  }
}

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.className = "";
    this.classList = new FakeClassList();
    this.style = {};
    this.listeners = new Map();
    this._button = null;
    this.innerHTML = "";
  }
  addEventListener(name, handler) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(handler);
  }
  removeEventListener() {}
  dispatch(name, extra = {}) {
    const event = {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      preventDefault() {},
      stopPropagation() {},
      ...extra
    };
    (this.listeners.get(name) || []).forEach((handler) => handler(event));
  }
  querySelector(selector) {
    if (selector !== "button") return null;
    if (!this._button) this._button = new FakeElement("button");
    return this._button;
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 800, height: 600 };
  }
}

class NativeLatLng {
  constructor(lat, lng) { this.lat = Number(lat); this.lng = Number(lng); }
  getLat() { return this.lat; }
  getLng() { return this.lng; }
}

class NativeBounds {
  constructor() { this.points = []; }
  extend(point) { this.points.push(point); }
}

class NativeMap {
  constructor(container, options) {
    this.container = container;
    this.center = options.center;
    this.level = options.level;
    this.draggable = true;
    this.relayoutCount = 0;
  }
  addControl() {}
  setMinLevel(value) { this.minLevel = value; }
  setMaxLevel(value) { this.maxLevel = value; }
  getLevel() { return this.level; }
  setLevel(value) { this.level = value; }
  setCenter(value) { this.center = value; }
  panTo(value) { this.center = value; }
  setBounds(value) { this.bounds = value; }
  relayout() { this.relayoutCount += 1; }
  setDraggable(value) { this.draggable = value; }
  getProjection() {
    return {
      coordsFromContainerPoint(point) {
        return new NativeLatLng(35 + point.y / 100000, 126 + point.x / 100000);
      }
    };
  }
}

class NativeOverlay {
  constructor(options = {}) {
    Object.assign(this, options);
    this.map = options.map || null;
    this.position = options.position || options.center || null;
  }
  setMap(map) { this.map = map; }
  setPosition(position) { this.position = position; }
  setRadius(radius) { this.radius = radius; }
}

class NativeGeometry extends NativeOverlay {
  constructor(options = {}) {
    super(options);
    this.options = options;
    this.path = options.path || [];
  }
}

const containers = new Map([
  ["test-map", new FakeElement("test-map")]
]);

globalThis.window = globalThis;
globalThis.document = {
  head: { appendChild() {} },
  querySelector() { return null; },
  createElement() { return new FakeElement(); },
  getElementById(id) { return containers.get(id) || null; },
  addEventListener() {},
  removeEventListener() {}
};
globalThis.SAFETY_MAP_RUNTIME_CONFIG = { kakaoJavaScriptKey: "adapter-test-key" };

const nativeEvents = {
  addListener(target, name, handler) {
    if (!target.__listeners) target.__listeners = new Map();
    if (!target.__listeners.has(name)) target.__listeners.set(name, []);
    target.__listeners.get(name).push(handler);
  },
  trigger(target, name, event) {
    (target.__listeners?.get(name) || []).forEach((handler) => handler(event));
  }
};

globalThis.kakao = {
  maps: {
    load(callback) { callback(); },
    Map: NativeMap,
    LatLng: NativeLatLng,
    LatLngBounds: NativeBounds,
    Point: class Point { constructor(x, y) { this.x = x; this.y = y; } },
    ZoomControl: class ZoomControl {},
    ControlPosition: { LEFT: "left" },
    CustomOverlay: NativeOverlay,
    Polyline: NativeGeometry,
    Polygon: NativeGeometry,
    Circle: NativeGeometry,
    event: nativeEvents
  }
};

await import("../kakao-map.js");
await globalThis.SafetyMapKakaoReady;

assert.ok(globalThis.KMap, "KMap adapter should be installed");

const map = KMap.map("test-map", { zoomControl: true, minZoom: 11, maxZoom: 19 });
assert.equal(map.getZoom(), 11);

let mapClick = null;
map.on("click", (event) => { mapClick = event.latlng; });
nativeEvents.trigger(map._native, "click", { latLng: new NativeLatLng(35.15, 126.88) });
assert.equal(mapClick.lat, 35.15);
assert.equal(mapClick.lng, 126.88);

const group = KMap.layerGroup().addTo(map);
const polygon = KMap.polygon([[35.1, 126.8], [35.2, 126.9], [35.15, 127.0]], {
  color: "#16855d",
  fillOpacity: 0.2
}).bindTooltip("테스트동", { permanent: true }).addTo(group);
assert.equal(polygon._native.map, map._native);
map.fitBounds(polygon.getBounds(), { padding: [20, 20] });
assert.ok(map._native.bounds instanceof NativeBounds);

const marker = KMap.marker([35.16, 126.89], {
  draggable: true,
  icon: KMap.divIcon({ html: "<b>점</b>", iconSize: [30, 30], iconAnchor: [15, 15] })
}).bindPopup("<strong>시설</strong>").addTo(group);
assert.equal(marker.getLatLng().lat, 35.16);
marker.setLatLng([35.17, 126.9]);
assert.equal(marker.getLatLng().lng, 126.9);
marker._content.dispatch("click");
assert.ok(marker._popup, "marker popup should open");

const circle = KMap.circle([35.18, 126.91], { radius: 25 }).addTo(group);
circle.setRadius(40).setLatLng([35.19, 126.92]);
assert.equal(circle._native.radius, 40);

group.clearLayers();
assert.equal(marker._native.map, null);
assert.equal(polygon._native.map, null);

map.invalidateSize();
assert.equal(map._native.relayoutCount, 1);

console.log("Kakao map adapter tests passed");
