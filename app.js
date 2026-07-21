(function () {
  "use strict";

  const DATA = window.SAFETY_MAP_DATA;
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
  const receiptLayer = L.layerGroup().addTo(map);
  let pendingMarker = null;

  populateDongSelect();
  bindEvents();
  renderDong();
  renderConnectionNotice();
  subscribeMapFeatures();

  function createMap(id) {
    const instance = L.map(id, { zoomControl: true, minZoom: 12, maxZoom: 19 });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(instance);
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

  function toLatLngs(points) {
    return points.map((point) => [Number(point.lat), Number(point.lon)]);
  }

  function normalizeSegments(segments) {
    if (!Array.isArray(segments) || !segments.length) return [];
    if (segments[0] && typeof segments[0].lat === "number") return [segments];
    return segments.filter(Array.isArray);
  }

  function drawBoundary(dong) {
    const line = L.polygon(toLatLngs(dong.boundary), {
      color: "#405b66",
      weight: 4,
      dashArray: "10 7",
      fill: false,
      lineJoin: "round"
    }).addTo(officialLayer);
    map.fitBounds(line.getBounds(), { padding: [22, 22] });
  }

  function drawOfficialData(dong) {
    getLineFeatures(dong).forEach((feature) => {
      const symbol = feature.type === "return" ? "□" : "○";
      const color = feature.type === "return" ? "#596caf" : "#2e8b62";
      L.polyline(feature.points.map((point) => [point.lat, point.lon]), { color, weight: 5, opacity: .9 })
        .bindPopup(`<strong>${symbol} ${escapeHtml(feature.name)}</strong><br>${escapeHtml(feature.location || "")}`)
        .addTo(officialLayer);
    });

    dong.safetyAlleys.forEach((item) => {
      if (item.kind !== "line" && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon))) {
        L.circleMarker([item.lat, item.lon], { radius: 8, color: "#2e8b62", weight: 4, fillColor: "#fff", fillOpacity: .9 })
          .bindPopup(`<strong>○ ${escapeHtml(item.name)}</strong>`)
          .addTo(officialLayer);
      }
    });

    dong.parcelLockers.forEach((item) => createOfficialMarker(item, "parcel", "☆", `☆ ${item.name}`).addTo(officialLayer));
    dong.vendingMachines.forEach((item) => createOfficialMarker(item, "vending", "△", `△ ${item.name}`).addTo(officialLayer));
  }

  function getLineFeatures(dong) {
    const base = [];
    dong.returnRoutes.forEach((item, index) => {
      const points = normalizeSegments(item.segments)[0] || [];
      base.push({
        id: baseFeatureId("return", dong.name, index),
        type: "return",
        dong: dong.name,
        name: item.name,
        location: item.location || "",
        points: points.map((point) => ({ lat: Number(point.lat), lon: Number(point.lon) })),
        active: true,
        baseFeature: true
      });
    });
    dong.safetyAlleys.forEach((item, index) => {
      if (item.kind !== "line") return;
      const points = normalizeSegments(item.segments)[0] || [];
      base.push({
        id: baseFeatureId("alley", dong.name, index),
        type: "alley",
        dong: dong.name,
        name: item.name,
        location: item.location || "",
        points: points.map((point) => ({ lat: Number(point.lat), lon: Number(point.lon) })),
        active: true,
        baseFeature: true
      });
    });

    const merged = new Map(base.map((feature) => [feature.id, feature]));
    state.featureOverrides.filter((feature) => feature.dong === dong.name).forEach((feature) => merged.set(feature.id, feature));
    return [...merged.values()].filter((feature) => feature.active !== false && feature.points.length >= 2);
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

  function createOfficialMarker(item, type, symbol, label) {
    return L.marker([Number(item.lat), Number(item.lon)], {
      icon: L.divIcon({
        className: "leaflet-div-icon",
        html: `<div class="official-marker ${type}">${symbol}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      })
    }).bindPopup(`<strong>${escapeHtml(label)}</strong>`);
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
    receiptLayer.clearLayers();
    drawBoundary(dong);
    drawOfficialData(dong);
    state.receipts.filter((report) => report.dong === dong.name).forEach((report) => createReceiptMarker(report).addTo(receiptLayer));
    document.getElementById("citizen-dong-title").textContent = `${dong.name} 지도`;
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
    button.textContent = "＋ 취약 위치 등록";
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
