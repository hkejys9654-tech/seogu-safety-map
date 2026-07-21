(function () {
  "use strict";

  const DATA = window.SAFETY_MAP_DATA;
  const LANDMARKS = window.SAFETY_MAP_LANDMARKS || { dongs: {} };
  const SERVICE = window.SafetyMapFirebase;
  const RECEIPT_KEY = "seogu-safety-map-device-receipts-v2";
  const STATUS_LABELS = {
    received: "접수",
    reviewing: "검토 중",
    reflected: "지도 반영",
    hold: "보류"
  };
  const TYPE_LABELS = {
    dark: "어두워요",
    surveillance: "CCTV·비상벨 부족",
    visibility: "시야가 가려져요",
    walking: "보행하기 위험해요",
    anxiety: "혼자 걷기 불안해요",
    other: "기타"
  };
  const TYPE_COLORS = {
    dark: "#d88a18",
    surveillance: "#d94d45",
    visibility: "#7c62a6",
    walking: "#2582a9",
    anxiety: "#c94f7c",
    other: "#65726e"
  };
  const DONG_COLORS = [
    "#1f8a70", "#2f78a8", "#7b68b3", "#cf6b55", "#d3973f", "#4f8f5b",
    "#348b91", "#8b6d52", "#a85f87", "#5476b8", "#6d8b3d", "#b76a42",
    "#3d8a68", "#6d72a8", "#ad7448", "#4d899a", "#8a6a9b", "#73854c"
  ];

  if (!DATA || !Array.isArray(DATA.dongs) || typeof L === "undefined" || !SERVICE) {
    document.body.innerHTML = "<p style='padding:24px'>지도를 불러오지 못했습니다. 인터넷 연결과 파일 구성을 확인해주세요.</p>";
    return;
  }

  const state = {
    dong: DATA.dongs[0].name,
    placing: false,
    pendingLatLng: null,
    receipts: readReceipts(),
    featureOverrides: []
  };

  const dongSelect = document.getElementById("citizen-dong");
  const mapInstruction = document.getElementById("map-instruction");
  const reportDialog = document.getElementById("report-dialog");
  const reportForm = document.getElementById("report-form");
  const note = document.getElementById("report-note");
  const submitButton = reportForm.querySelector('button[type="submit"]');
  const map = createMap("citizen-map");
  const officialLayer = L.layerGroup().addTo(map);
  const landmarkLayer = L.layerGroup().addTo(map);
  const receiptLayer = L.layerGroup().addTo(map);
  let pendingMarker = null;

  populateDongSelect();
  bindEvents();
  renderDong();
  renderConnectionNotice();
  subscribeMapFeatures();

  function createMap(id) {
    const instance = L.map(id, { zoomControl: true, minZoom: 12, maxZoom: 19 });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
    }).addTo(instance);
    const updateLabels = () => instance.getContainer().classList.toggle("show-landmark-labels", instance.getZoom() >= 15);
    instance.on("zoomend", updateLabels);
    updateLabels();
    return instance;
  }

  function populateDongSelect() {
    DATA.dongs.forEach((dong) => dongSelect.add(new Option(dong.name, dong.name)));
    dongSelect.value = state.dong;
  }

  function bindEvents() {
    dongSelect.addEventListener("change", () => {
      state.dong = dongSelect.value;
      cancelPlacement();
      renderDong();
    });
    document.getElementById("start-report").addEventListener("click", startPlacement);
    document.getElementById("citizen-landmark-toggle").addEventListener("change", (event) => {
      if (event.target.checked) landmarkLayer.addTo(map);
      else map.removeLayer(landmarkLayer);
    });
    map.on("click", onMapClick);
    document.getElementById("close-dialog").addEventListener("click", closeReportDialog);
    document.getElementById("cancel-report").addEventListener("click", closeReportDialog);
    reportForm.addEventListener("submit", submitReport);
    note.addEventListener("input", () => {
      document.getElementById("note-count").textContent = String(note.value.length);
    });
  }

  function renderConnectionNotice() {
    const notice = document.getElementById("connection-notice");
    if (SERVICE.isConfigured()) {
      notice.classList.add("is-connected");
      notice.innerHTML = "<strong>공동 자료 저장소 연결</strong><span>등록한 의견은 관리자 화면에 바로 전달됩니다.</span>";
    } else {
      notice.classList.add("is-demo");
      notice.innerHTML = "<strong>시범 실행 중</strong><span>Firebase 설정 전이라 이 기기에만 저장됩니다.</span>";
    }
  }

  function getDong(name) {
    return DATA.dongs.find((dong) => dong.name === name);
  }

  function getDongColor(name) {
    const index = DATA.dongs.findIndex((dong) => dong.name === name);
    return DONG_COLORS[Math.max(0, index) % DONG_COLORS.length];
  }

  function toLatLngs(points) {
    return points.map((point) => [Number(point.lat), Number(point.lon)]);
  }

  function normalizeSegments(segments) {
    if (!Array.isArray(segments) || !segments.length) return [];
    if (segments[0] && typeof segments[0].lat === "number") return [segments];
    return segments.filter(Array.isArray);
  }

  function drawBoundary(dong) {
    const color = getDongColor(dong.name);
    const line = L.polygon(toLatLngs(dong.boundary), {
      color,
      weight: 5,
      opacity: .95,
      fill: true,
      fillColor: color,
      fillOpacity: .16,
      lineJoin: "round"
    }).addTo(officialLayer);
    map.fitBounds(line.getBounds(), { padding: [22, 22] });
  }

  function drawOfficialData(dong) {
    getLineFeatures(dong).forEach((feature) => {
      const symbols = { return: "□", alley: "○", parcel: "☆", vending: "△" };
      const colors = { return: "#596caf", alley: "#2e8b62", parcel: "#7c62a6", vending: "#cb574a" };
      const symbol = symbols[feature.type] || "□";
      const color = colors[feature.type] || colors.return;
      if (feature.geometry === "point") {
        const point = feature.points[0];
        createOfficialMarker(point, feature.type, symbol, `${symbol} ${feature.name}`, feature.location).addTo(officialLayer);
      } else {
        L.polyline(feature.points.map((point) => [point.lat, point.lon]), { color, weight: 5, opacity: .9 })
          .bindPopup(`<strong>${symbol} ${escapeHtml(feature.name)}</strong><br>${escapeHtml(feature.location || "")}`)
          .addTo(officialLayer);
      }
    });
  }

  function drawLandmarks(dong) {
    const categorySymbols = { school: "학", park: "공", apartment: "아", public: "관", transit: "역" };
    const items = LANDMARKS.dongs && Array.isArray(LANDMARKS.dongs[dong.name]) ? LANDMARKS.dongs[dong.name] : [];
    items.forEach((item) => {
      const symbol = categorySymbols[item.category] || "점";
      L.marker([Number(item.lat), Number(item.lon)], {
        interactive: false,
        keyboard: false,
        zIndexOffset: -500,
        icon: L.divIcon({
          className: "leaflet-div-icon landmark-icon",
          html: `<div class="landmark-marker ${escapeHtml(item.category)}"><span class="landmark-dot">${symbol}</span><span class="landmark-label">${escapeHtml(item.name)}</span></div>`,
          iconSize: [27, 27],
          iconAnchor: [13, 13]
        })
      }).addTo(landmarkLayer);
    });
  }

  function getLineFeatures(dong) {
    const base = [];
    dong.returnRoutes.forEach((item, index) => {
      const points = normalizeSegments(item.segments)[0] || [];
      base.push({
        id: baseFeatureId("return", dong.name, index),
        type: "return",
        geometry: "line",
        dong: dong.name,
        name: item.name,
        location: item.location || "",
        points: points.map((point) => ({ lat: Number(point.lat), lon: Number(point.lon) })),
        active: true,
        baseFeature: true
      });
    });
    dong.safetyAlleys.forEach((item, index) => {
      const isLine = item.kind === "line";
      const savedPoint = item.point || item;
      const points = isLine
        ? (normalizeSegments(item.segments)[0] || [])
        : (Number.isFinite(Number(savedPoint.lat)) && Number.isFinite(Number(savedPoint.lon))
          ? [{ lat: savedPoint.lat, lon: savedPoint.lon }]
          : []);
      base.push({
        id: baseFeatureId(isLine ? "alley" : "alleypoint", dong.name, index),
        type: "alley",
        geometry: isLine ? "line" : "point",
        dong: dong.name,
        name: item.name,
        location: item.location || "",
        points: points.map((point) => ({ lat: Number(point.lat), lon: Number(point.lon) })),
        active: true,
        baseFeature: true
      });
    });
    dong.parcelLockers.forEach((item, index) => base.push({
      id: baseFeatureId("parcel", dong.name, index),
      type: "parcel",
      geometry: "point",
      dong: dong.name,
      name: item.name,
      location: item.address || "",
      points: [{ lat: Number(item.lat), lon: Number(item.lon) }],
      active: true,
      baseFeature: true
    }));
    dong.vendingMachines.forEach((item, index) => base.push({
      id: baseFeatureId("vending", dong.name, index),
      type: "vending",
      geometry: "point",
      dong: dong.name,
      name: item.name,
      location: item.detail || "",
      points: [{ lat: Number(item.lat), lon: Number(item.lon) }],
      active: true,
      baseFeature: true
    }));

    const merged = new Map(base.map((feature) => [feature.id, feature]));
    state.featureOverrides.filter((feature) => feature.dong === dong.name).forEach((feature) => merged.set(feature.id, feature));
    return [...merged.values()].filter((feature) => feature.active !== false
      && feature.points.length >= (feature.geometry === "point" ? 1 : 2));
  }

  function baseFeatureId(type, dong, index) {
    return `${type}__${dong}__${index}`;
  }

  async function subscribeMapFeatures() {
    try {
      await SERVICE.listenMapFeatures((features) => {
        state.featureOverrides = features;
        renderDong();
      }, () => showToast("최신 안전시설 선을 불러오지 못했습니다."));
    } catch (_) {
      showToast("최신 안전시설 선을 불러오지 못했습니다.");
    }
  }

  function createOfficialMarker(item, type, symbol, label, location) {
    return L.marker([Number(item.lat), Number(item.lon)], {
      icon: L.divIcon({
        className: "leaflet-div-icon",
        html: `<div class="official-marker ${type}">${symbol}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      })
    }).bindPopup(`<strong>${escapeHtml(label)}</strong>${location ? `<br>${escapeHtml(location)}` : ""}`);
  }

  function createReceiptMarker(report) {
    const color = TYPE_COLORS[report.type] || TYPE_COLORS.other;
    return L.marker([report.lat, report.lon], {
      icon: L.divIcon({
        className: "leaflet-div-icon",
        html: `<div class="citizen-marker" style="background:${color}"></div>`,
        iconSize: [27, 27],
        iconAnchor: [13, 13]
      })
    }).bindPopup(`<strong>${escapeHtml(report.dong)} · ${escapeHtml(TYPE_LABELS[report.type] || "기타")}</strong><br>${escapeHtml(report.note)}`);
  }

  function renderDong() {
    const dong = getDong(state.dong);
    officialLayer.clearLayers();
    landmarkLayer.clearLayers();
    receiptLayer.clearLayers();
    drawBoundary(dong);
    drawLandmarks(dong);
    drawOfficialData(dong);
    state.receipts.filter((report) => report.dong === dong.name).forEach((report) => createReceiptMarker(report).addTo(receiptLayer));
    document.getElementById("citizen-dong-title").textContent = `${dong.name} 지도`;
    document.getElementById("selected-dong-name").textContent = dong.name;
    renderReceipts();
  }

  function startPlacement() {
    state.placing = true;
    mapInstruction.hidden = false;
    const button = document.getElementById("start-report");
    button.textContent = "지도에서 위치를 눌러주세요";
    button.disabled = true;
    map.getContainer().style.cursor = "crosshair";
  }

  function cancelPlacement() {
    state.placing = false;
    state.pendingLatLng = null;
    mapInstruction.hidden = true;
    const button = document.getElementById("start-report");
    button.textContent = "＋ 지도에 의견 남기기";
    button.disabled = false;
    map.getContainer().style.cursor = "";
    if (pendingMarker) {
      pendingMarker.remove();
      pendingMarker = null;
    }
  }

  function onMapClick(event) {
    if (!state.placing) return;
    state.pendingLatLng = event.latlng;
    if (pendingMarker) pendingMarker.remove();
    pendingMarker = L.circleMarker(event.latlng, {
      radius: 11,
      color: "#fff",
      weight: 4,
      fillColor: "#e06645",
      fillOpacity: 1
    }).addTo(map);
    document.getElementById("selected-location").textContent = `${state.dong} · 위도 ${event.latlng.lat.toFixed(6)}, 경도 ${event.latlng.lng.toFixed(6)}`;
    reportForm.reset();
    document.getElementById("note-count").textContent = "0";
    reportDialog.showModal();
  }

  function closeReportDialog() {
    reportDialog.close();
    cancelPlacement();
  }

  async function submitReport(event) {
    event.preventDefault();
    if (!state.pendingLatLng) return;
    const formData = new FormData(reportForm);
    const type = String(formData.get("type") || "");
    const reportNote = note.value.trim();
    if (!type || !reportNote) return;

    const report = {
      dong: state.dong,
      type,
      note: reportNote,
      lat: Number(state.pendingLatLng.lat.toFixed(7)),
      lon: Number(state.pendingLatLng.lng.toFixed(7))
    };

    submitButton.disabled = true;
    submitButton.textContent = "등록 중…";
    try {
      const saved = await SERVICE.addReport(report);
      state.receipts.unshift({
        ...report,
        id: saved.id,
        status: "received",
        createdAt: saved.createdAt || new Date().toISOString()
      });
      writeReceipts();
      reportDialog.close();
      cancelPlacement();
      renderDong();
      showToast(SERVICE.isConfigured() ? "의견이 관리자에게 전달되었습니다." : "시범 의견이 이 기기에 저장되었습니다.");
    } catch (error) {
      showToast("등록하지 못했습니다. 인터넷 연결을 확인해주세요.");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "의견 등록";
    }
  }

  function renderReceipts() {
    const reports = state.receipts.filter((report) => report.dong === state.dong);
    const container = document.getElementById("my-report-list");
    document.getElementById("my-report-count").textContent = `${reports.length}건`;
    if (!reports.length) {
      container.innerHTML = '<div class="empty-state">아직 등록한 의견이 없습니다. 지도에서 취약한 위치를 표시해보세요.</div>';
      return;
    }
    container.innerHTML = reports.map((report) => `
      <article class="report-card">
        <div class="report-card-head">
          <span class="type-badge">${escapeHtml(TYPE_LABELS[report.type] || "기타")}</span>
          <span class="status-badge">${escapeHtml(STATUS_LABELS[report.status] || "접수")}</span>
        </div>
        <p>${escapeHtml(report.note)}</p>
        <div class="report-meta"><span>${formatDate(report.createdAt)}</span><span>${Number(report.lat).toFixed(5)}, ${Number(report.lon).toFixed(5)}</span></div>
      </article>`).join("");
  }

  function readReceipts() {
    try {
      const parsed = JSON.parse(localStorage.getItem(RECEIPT_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writeReceipts() {
    try {
      localStorage.setItem(RECEIPT_KEY, JSON.stringify(state.receipts.slice(0, 100)));
    } catch (_) {
      // 등록은 이미 완료되었으므로 기기 내 접수내역 저장 실패만 무시합니다.
    }
  }

  function formatDate(value) {
    const date = new Date(value);
    return new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { toast.hidden = true; }, 2800);
  }
})();
