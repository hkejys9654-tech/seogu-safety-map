(function (global) {
  "use strict";

  const config = global.SAFETY_MAP_RUNTIME_CONFIG || {};
  const javascriptKey = String(config.kakaoJavaScriptKey || "").trim();

  global.SafetyMapKakaoReady = loadKakaoMaps(javascriptKey)
    .then(() => {
      global.KMap = createKakaoMapAdapter(global.kakao.maps);
      global.SAFETY_MAP_PROVIDER = "kakao";
      return global.KMap;
    })
    .catch(async (error) => {
      console.warn("카카오맵을 불러오지 못해 예비 지도로 전환합니다.", error);
      await loadLeafletFallback();
      global.KMap = createLeafletFallback(global.L);
      global.SAFETY_MAP_PROVIDER = "openstreetmap-fallback";
      return global.KMap;
    });

  function loadKakaoMaps(key) {
    if (!key) {
      return Promise.reject(new Error("KAKAO_MAP_JAVASCRIPT_KEY가 설정되지 않았습니다."));
    }

    return new Promise((resolve, reject) => {
      const finishLoading = () => {
        if (!global.kakao || !global.kakao.maps || typeof global.kakao.maps.load !== "function") {
          reject(new Error("카카오맵 JavaScript SDK를 초기화하지 못했습니다."));
          return;
        }
        global.kakao.maps.load(resolve);
      };

      if (global.kakao && global.kakao.maps) {
        finishLoading();
        return;
      }

      const existing = document.querySelector("script[data-safety-map-kakao-sdk]");
      if (existing) {
        existing.addEventListener("load", finishLoading, { once: true });
        existing.addEventListener("error", () => reject(new Error("카카오맵 SDK를 불러오지 못했습니다.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.dataset.safetyMapKakaoSdk = "true";
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
      script.onload = finishLoading;
      script.onerror = () => reject(new Error("카카오맵 SDK를 불러오지 못했습니다. 허용 도메인과 JavaScript 키를 확인해주세요."));
      document.head.appendChild(script);
    });
  }

  function loadLeafletFallback() {
    return new Promise((resolve, reject) => {
      if (global.L) {
        resolve();
        return;
      }

      if (!document.querySelector("link[data-safety-map-leaflet-fallback]")) {
        const stylesheet = document.createElement("link");
        stylesheet.rel = "stylesheet";
        stylesheet.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        stylesheet.dataset.safetyMapLeafletFallback = "true";
        document.head.appendChild(stylesheet);
      }

      const existing = document.querySelector("script[data-safety-map-leaflet-fallback]");
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", () => reject(new Error("예비 지도도 불러오지 못했습니다.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.dataset.safetyMapLeafletFallback = "true";
      script.onload = resolve;
      script.onerror = () => reject(new Error("예비 지도도 불러오지 못했습니다."));
      document.head.appendChild(script);
    });
  }

  function createLeafletFallback(leaflet) {
    const fallback = Object.create(leaflet);
    fallback.map = (id, options) => {
      const map = leaflet.map(id, options);
      leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(map);
      return map;
    };
    return fallback;
  }

  function createKakaoMapAdapter(maps) {
    const DEFAULT_CENTER = { lat: 35.1519, lng: 126.8895 };

    class LatLng {
      constructor(lat, lng) {
        this.lat = Number(lat);
        this.lng = Number(lng);
      }

      toKakao() {
        return new maps.LatLng(this.lat, this.lng);
      }
    }

    function latLng(value, lng) {
      if (value instanceof LatLng) return value;
      if (arguments.length === 2) return new LatLng(value, lng);
      if (Array.isArray(value)) return new LatLng(value[0], value[1]);
      if (value && typeof value.getLat === "function" && typeof value.getLng === "function") {
        return new LatLng(value.getLat(), value.getLng());
      }
      if (value && typeof value === "object") {
        return new LatLng(value.lat, value.lng ?? value.lon);
      }
      throw new TypeError("올바른 위도·경도 값이 아닙니다.");
    }

    class LatLngBounds {
      constructor(values) {
        this._points = [];
        if (values) this.extend(values);
      }

      extend(value) {
        if (value instanceof LatLngBounds) {
          value._points.forEach((point) => this.extend(point));
          return this;
        }
        if (Array.isArray(value) && value.length && (Array.isArray(value[0]) || value[0] instanceof LatLng || typeof value[0] === "object")) {
          value.forEach((point) => this.extend(point));
          return this;
        }
        this._points.push(latLng(value));
        return this;
      }

      toKakao() {
        const bounds = new maps.LatLngBounds();
        this._points.forEach((point) => bounds.extend(point.toKakao()));
        return bounds;
      }

      getCenter() {
        if (!this._points.length) return latLng(DEFAULT_CENTER);
        const latitudes = this._points.map((point) => point.lat);
        const longitudes = this._points.map((point) => point.lng);
        return new LatLng(
          (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
          (Math.min(...longitudes) + Math.max(...longitudes)) / 2
        );
      }
    }

    function latLngBounds(values) {
      return new LatLngBounds(values);
    }

    function zoomToLevel(zoom) {
      return Math.max(1, Math.min(14, 20 - Number(zoom || 13)));
    }

    function levelToZoom(level) {
      return Math.max(1, Math.min(19, 20 - Number(level || 7)));
    }

    function normalizePadding(options) {
      const padding = options && Array.isArray(options.padding) ? options.padding : [0, 0];
      return { x: Number(padding[0]) || 0, y: Number(padding[1]) || 0 };
    }

    class MapAdapter {
      constructor(id, options = {}) {
        this._container = typeof id === "string" ? document.getElementById(id) : id;
        if (!this._container) throw new Error(`지도 영역을 찾지 못했습니다: ${id}`);
        this._events = new Map();
        this._native = new maps.Map(this._container, {
          center: latLng(DEFAULT_CENTER).toKakao(),
          level: zoomToLevel(options.minZoom || 12)
        });
        if (typeof this._native.setMinLevel === "function" && options.maxZoom) {
          this._native.setMinLevel(zoomToLevel(options.maxZoom));
        }
        if (typeof this._native.setMaxLevel === "function" && options.minZoom) {
          this._native.setMaxLevel(zoomToLevel(options.minZoom));
        }
        if (options.zoomControl !== false && maps.ZoomControl && maps.ControlPosition) {
          this._native.addControl(new maps.ZoomControl(), maps.ControlPosition.LEFT);
        }
      }

      on(name, handler) {
        if (!this._events.has(name)) {
          this._events.set(name, []);
          const nativeName = name === "zoomend" ? "zoom_changed" : name;
          maps.event.addListener(this._native, nativeName, (event) => {
            const payload = name === "click" && event && event.latLng
              ? { latlng: latLng(event.latLng), originalEvent: null }
              : event;
            (this._events.get(name) || []).forEach((listener) => listener(payload));
          });
        }
        this._events.get(name).push(handler);
        return this;
      }

      getContainer() {
        return this._container;
      }

      getZoom() {
        return levelToZoom(this._native.getLevel());
      }

      setView(value, zoom, options = {}) {
        const center = latLng(value).toKakao();
        if (Number.isFinite(Number(zoom))) {
          this._native.setLevel(zoomToLevel(zoom), { animate: options.animate === true, anchor: center });
        }
        if (options.animate && typeof this._native.panTo === "function") this._native.panTo(center);
        else this._native.setCenter(center);
        return this;
      }

      fitBounds(bounds, options = {}) {
        const normalized = bounds instanceof LatLngBounds ? bounds : new LatLngBounds(bounds);
        const padding = normalizePadding(options);
        this._native.setBounds(normalized.toKakao(), padding.y, padding.x, padding.y, padding.x);
        return this;
      }

      invalidateSize() {
        this._native.relayout();
        return this;
      }

      addLayer(layer) {
        if (layer && typeof layer._attach === "function") layer._attach(this);
        return this;
      }

      removeLayer(layer) {
        if (layer && typeof layer._detach === "function") layer._detach();
        return this;
      }
    }

    class LayerGroup {
      constructor() {
        this._layers = new Set();
        this._map = null;
      }

      addTo(map) {
        this._attach(map);
        return this;
      }

      addLayer(layer) {
        this._layers.add(layer);
        layer._parentGroup = this;
        if (this._map) layer._attach(this._map);
        return this;
      }

      removeLayer(layer) {
        if (!this._layers.has(layer)) return this;
        layer._detach();
        layer._parentGroup = null;
        this._layers.delete(layer);
        return this;
      }

      clearLayers() {
        this._layers.forEach((layer) => {
          layer._detach();
          layer._parentGroup = null;
        });
        this._layers.clear();
        return this;
      }

      _attach(map) {
        this._map = map;
        this._layers.forEach((layer) => layer._attach(map));
      }

      _detach() {
        this._layers.forEach((layer) => layer._detach());
        this._map = null;
      }
    }

    class BaseLayer {
      constructor(options = {}) {
        this.options = options;
        this._map = null;
        this._parentGroup = null;
        this._events = new Map();
        this._popupHtml = "";
        this._popup = null;
        this._tooltipText = "";
        this._tooltipOptions = null;
        this._tooltip = null;
      }

      addTo(target) {
        if (target instanceof LayerGroup) target.addLayer(this);
        else this._attach(target);
        return this;
      }

      remove() {
        if (this._parentGroup) this._parentGroup.removeLayer(this);
        else this._detach();
        return this;
      }

      on(name, handler) {
        if (!this._events.has(name)) this._events.set(name, []);
        this._events.get(name).push(handler);
        return this;
      }

      bindPopup(html) {
        this._popupHtml = String(html || "");
        return this;
      }

      bindTooltip(text, options = {}) {
        this._tooltipText = String(text || "");
        this._tooltipOptions = options;
        this._refreshTooltipBinding();
        if (this._map && options.permanent) this._showTooltip(this._tooltipPosition(), true);
        return this;
      }

      _emit(name, payload = {}) {
        if (name === "click" && this._popupHtml) this._showPopup(payload.latlng || this._eventPosition());
        (this._events.get(name) || []).forEach((handler) => handler({ ...payload, target: this }));
      }

      _attach(map) {
        this._map = map;
        this._setNativeMap(map._native);
        this._refreshTooltipBinding();
        if (this._tooltipOptions && this._tooltipOptions.permanent) {
          this._showTooltip(this._tooltipPosition(), true);
        }
      }

      _detach() {
        this._setNativeMap(null);
        this._closePopup();
        this._hideTooltip();
        this._map = null;
      }

      _setNativeMap() {}

      _eventPosition() {
        return latLng(DEFAULT_CENTER);
      }

      _tooltipPosition() {
        return this._eventPosition();
      }

      _refreshTooltipBinding() {}

      _showPopup(position) {
        if (!this._map || !this._popupHtml) return;
        this._closePopup();
        const content = document.createElement("div");
        content.className = "kakao-map-popup";
        content.innerHTML = `<div class="kakao-map-popup-content">${this._popupHtml}</div><button type="button" aria-label="닫기">×</button>`;
        content.addEventListener("click", (event) => event.stopPropagation());
        content.addEventListener("pointerdown", (event) => event.stopPropagation());
        content.querySelector("button").addEventListener("click", () => this._closePopup());
        this._popup = new maps.CustomOverlay({
          map: this._map._native,
          position: latLng(position).toKakao(),
          content,
          xAnchor: 0.5,
          yAnchor: 1.18,
          zIndex: 1500,
          clickable: true
        });
      }

      _closePopup() {
        if (this._popup) this._popup.setMap(null);
        this._popup = null;
      }

      _showTooltip(position, permanent = false) {
        if (!this._map || !this._tooltipText) return;
        if (!permanent) this._hideTooltip();
        const content = document.createElement("div");
        content.className = `kakao-map-tooltip ${this._tooltipOptions && this._tooltipOptions.className ? this._tooltipOptions.className : ""}`.trim();
        content.textContent = this._tooltipText;
        this._tooltip = new maps.CustomOverlay({
          map: this._map._native,
          position: latLng(position).toKakao(),
          content,
          xAnchor: 0.5,
          yAnchor: 0.5,
          zIndex: 900
        });
      }

      _moveTooltip(position) {
        if (this._tooltip) this._tooltip.setPosition(latLng(position).toKakao());
      }

      _hideTooltip() {
        if (this._tooltip) this._tooltip.setMap(null);
        this._tooltip = null;
      }
    }

    class GeometryLayer extends BaseLayer {
      constructor(options = {}) {
        super(options);
        this._native = null;
      }

      _wireNativeEvents() {
        if (!this._native || this.options.interactive === false) return;
        maps.event.addListener(this._native, "click", (event) => {
          this._emit("click", { latlng: event && event.latLng ? latLng(event.latLng) : this._eventPosition(), originalEvent: null });
        });
        maps.event.addListener(this._native, "mouseover", (event) => {
          if (this._tooltipText && !(this._tooltipOptions && this._tooltipOptions.permanent)) {
            this._showTooltip(event && event.latLng ? latLng(event.latLng) : this._tooltipPosition());
          }
        });
        maps.event.addListener(this._native, "mousemove", (event) => {
          if (this._tooltip && this._tooltipOptions && this._tooltipOptions.sticky && event && event.latLng) {
            this._moveTooltip(latLng(event.latLng));
          }
        });
        maps.event.addListener(this._native, "mouseout", () => {
          if (!(this._tooltipOptions && this._tooltipOptions.permanent)) this._hideTooltip();
        });
      }

      _setNativeMap(nativeMap) {
        if (this._native) this._native.setMap(nativeMap);
      }
    }

    function pathToKakao(points) {
      return points.map((point) => latLng(point).toKakao());
    }

    function geometryStyle(options, polygon = false) {
      const style = {
        strokeWeight: Number(options.weight) || 3,
        strokeColor: options.color || "#3388ff",
        strokeOpacity: options.opacity ?? 1,
        strokeStyle: options.dashArray ? "shortdash" : "solid"
      };
      if (polygon) {
        style.fillColor = options.fillColor || options.color || "#3388ff";
        style.fillOpacity = options.fill === false ? 0 : (options.fillOpacity ?? 0.2);
      }
      return style;
    }

    class PolylineLayer extends GeometryLayer {
      constructor(points, options = {}) {
        super(options);
        this._points = points.map((point) => latLng(point));
        this._native = new maps.Polyline({
          path: pathToKakao(this._points),
          ...geometryStyle(options),
          clickable: options.interactive !== false
        });
        this._wireNativeEvents();
      }

      getBounds() {
        return new LatLngBounds(this._points);
      }

      _eventPosition() {
        return this.getBounds().getCenter();
      }

      _tooltipPosition() {
        return this._eventPosition();
      }
    }

    class PolygonLayer extends GeometryLayer {
      constructor(points, options = {}) {
        super(options);
        this._points = points.map((point) => latLng(point));
        this._native = new maps.Polygon({
          path: pathToKakao(this._points),
          ...geometryStyle(options, true),
          clickable: options.interactive !== false
        });
        this._wireNativeEvents();
      }

      getBounds() {
        return new LatLngBounds(this._points);
      }

      _eventPosition() {
        return this.getBounds().getCenter();
      }

      _tooltipPosition() {
        return this._eventPosition();
      }
    }

    class CircleLayer extends GeometryLayer {
      constructor(center, options = {}) {
        super(options);
        this._center = latLng(center);
        this._radius = Number(options.radius) || 1;
        this._native = new maps.Circle({
          center: this._center.toKakao(),
          radius: this._radius,
          ...geometryStyle(options, true),
          clickable: options.interactive !== false
        });
        this._wireNativeEvents();
      }

      setLatLng(value) {
        this._center = latLng(value);
        this._native.setPosition(this._center.toKakao());
        return this;
      }

      setRadius(radius) {
        this._radius = Number(radius) || 1;
        this._native.setRadius(this._radius);
        return this;
      }

      _eventPosition() {
        return this._center;
      }
    }

    function divIcon(options = {}) {
      return { ...options };
    }

    class MarkerLayer extends BaseLayer {
      constructor(position, options = {}) {
        super(options);
        this._position = latLng(position);
        this._icon = options.icon || divIcon({ html: "", iconSize: [24, 24], iconAnchor: [12, 12] });
        this._content = this._createContent();
        const size = this._icon.iconSize || [24, 24];
        const anchor = this._icon.iconAnchor || [size[0] / 2, size[1] / 2];
        this._native = new maps.CustomOverlay({
          position: this._position.toKakao(),
          content: this._content,
          xAnchor: size[0] ? anchor[0] / size[0] : 0.5,
          yAnchor: size[1] ? anchor[1] / size[1] : 0.5,
          zIndex: Math.max(1, 100 + (Number(options.zIndexOffset) || 0)),
          clickable: options.interactive !== false
        });
        this._wireDomEvents();
      }

      _createContent() {
        const size = this._icon.iconSize || [24, 24];
        const content = document.createElement("div");
        content.className = `kakao-html-marker ${this._icon.className || ""}`.trim();
        content.style.width = `${Number(size[0]) || 24}px`;
        content.style.height = `${Number(size[1]) || 24}px`;
        content.style.pointerEvents = this.options.interactive === false ? "none" : "auto";
        content.innerHTML = this._icon.html || "";
        return content;
      }

      _wireDomEvents() {
        let dragState = null;
        let moved = false;

        this._content.addEventListener("click", (event) => {
          event.stopPropagation();
          if (moved) {
            moved = false;
            return;
          }
          this._emit("click", { latlng: this._position, originalEvent: event });
        });

        this._content.addEventListener("pointerenter", () => {
          if (this._tooltipText && !(this._tooltipOptions && this._tooltipOptions.permanent)) {
            this._showTooltip(this._position);
          }
        });
        this._content.addEventListener("pointerleave", () => {
          if (!(this._tooltipOptions && this._tooltipOptions.permanent)) this._hideTooltip();
        });

        if (!this.options.draggable) return;
        this._content.style.touchAction = "none";
        this._content.style.cursor = "grab";

        const move = (event) => {
          if (!dragState || !this._map || event.pointerId !== dragState.pointerId) return;
          const container = this._map.getContainer();
          const rect = container.getBoundingClientRect();
          const point = new maps.Point(event.clientX - rect.left, event.clientY - rect.top);
          const nativePosition = this._map._native.getProjection().coordsFromContainerPoint(point);
          this._position = latLng(nativePosition);
          this._native.setPosition(nativePosition);
          moved = true;
          event.preventDefault();
        };

        const end = (event) => {
          if (!dragState || event.pointerId !== dragState.pointerId) return;
          dragState = null;
          if (this._map) this._map._native.setDraggable(true);
          this._content.style.cursor = "grab";
          document.removeEventListener("pointermove", move);
          document.removeEventListener("pointerup", end);
          document.removeEventListener("pointercancel", end);
          this._emit("dragend", { latlng: this._position, originalEvent: event });
        };

        this._content.addEventListener("pointerdown", (event) => {
          if (!this._map) return;
          event.preventDefault();
          event.stopPropagation();
          moved = false;
          dragState = { pointerId: event.pointerId };
          this._map._native.setDraggable(false);
          this._content.style.cursor = "grabbing";
          document.addEventListener("pointermove", move, { passive: false });
          document.addEventListener("pointerup", end);
          document.addEventListener("pointercancel", end);
        });
      }

      _setNativeMap(nativeMap) {
        this._native.setMap(nativeMap);
      }

      setLatLng(value) {
        this._position = latLng(value);
        this._native.setPosition(this._position.toKakao());
        return this;
      }

      getLatLng() {
        return new LatLng(this._position.lat, this._position.lng);
      }

      _eventPosition() {
        return this._position;
      }

      _tooltipPosition() {
        return this._position;
      }

      _refreshTooltipBinding() {
        if (this._tooltipText) this._content.title = this._tooltipText;
      }
    }

    class CircleMarkerLayer extends BaseLayer {
      constructor(position, options = {}) {
        super(options);
        this._position = latLng(position);
        const radius = Number(options.radius) || 10;
        this._content = document.createElement("span");
        this._content.className = "kakao-circle-marker";
        Object.assign(this._content.style, {
          width: `${radius * 2}px`,
          height: `${radius * 2}px`,
          border: `${Number(options.weight) || 2}px solid ${options.color || "#3388ff"}`,
          borderRadius: "50%",
          background: options.fillColor || options.color || "#3388ff",
          opacity: String(options.fillOpacity ?? 1),
          boxSizing: "border-box",
          display: "block",
          boxShadow: "0 2px 8px rgba(25,35,32,.24)"
        });
        this._native = new maps.CustomOverlay({
          position: this._position.toKakao(),
          content: this._content,
          xAnchor: 0.5,
          yAnchor: 0.5,
          zIndex: 1200
        });
      }

      _setNativeMap(nativeMap) {
        this._native.setMap(nativeMap);
      }

      setLatLng(value) {
        this._position = latLng(value);
        this._native.setPosition(this._position.toKakao());
        return this;
      }

      _eventPosition() {
        return this._position;
      }
    }

    return Object.freeze({
      map: (id, options) => new MapAdapter(id, options),
      layerGroup: () => new LayerGroup(),
      latLng,
      latLngBounds,
      polygon: (points, options) => new PolygonLayer(points, options),
      polyline: (points, options) => new PolylineLayer(points, options),
      marker: (position, options) => new MarkerLayer(position, options),
      circle: (position, options) => new CircleLayer(position, options),
      circleMarker: (position, options) => new CircleMarkerLayer(position, options),
      divIcon,
      DomEvent: {
        stopPropagation(event) {
          if (event && typeof event.stopPropagation === "function") event.stopPropagation();
        }
      }
    });
  }
})(window);
