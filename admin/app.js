(function () {
  "use strict";

  const DATA = window.SAFETY_MAP_DATA;
  const LANDMARKS = window.SAFETY_MAP_LANDMARKS || { dongs: {} };
  const SERVICE = window.SafetyMapFirebase;
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
  const FEATURE_LABELS = {
    return: "안심귀갓길",
    alley: "안전골목",
    parcel: "안심택배보관함",
    vending: "비상생리대 자판기"
  };
  const FEATURE_COLORS = {
    return: "#596caf",
    alley: "#2e8b62",
    parcel: "#7c62a6",
    vending: "#cb574a"
  };
  const FEATURE_SYMBOLS = { return: "□", alley: "○", parcel: "☆", vending: "△" };

  if (!DATA || !Array.isArray(DATA.dongs) || typeof L === "undefined" || !SERVICE) {
    document.body.innerHTML = "<p style='padding:24px'>관리자 앱을 불러오지 못했습니다. 인터넷 연결과 파일 구성을 확인해주세요.</p>";
    return;
  }

  const state = {
    reports: [],
    dong: "all",
    status: "all",
    user: null,
    unsubscribeReports: null,
    unsubscribeFeatures: null,
    featureOverrides: [],
    selectedFeature: null,
    featureBefore: null,
    editMode: null,
    editingReport: null,
    relocatingReport: false
  };

  const authGate = document.getElementById("auth-gate");
  const adminApp = document.getElementById("admin-app");
  const dongSelect = document.getElementById("admin-dong");
  const statusSelect = document.getElementById("admin-status");
  const reportDialog = document.getElementById("admin-report-dialog");
  const reportForm = document.getElementById("admin-report-form");
  let map = null;
  let officialLayer = null;
  let landmarkLayer = null;
  let featureLayer = null;
  let reportLayer = null;
  let editLayer = null;

  populateDongSelect();
  bindEvents();
  startAuthentication();

  function populateDongSelect() {
    const editDong = document.getElementById("edit-report-dong");
    DATA.dongs.forEach((dong) => {
      dongSelect.add(new Option(dong.name, dong.name));
      editDong.add(new Option(dong.name, dong.name));
    });
  }

  function bindEvents() {
    document.getElementById("sign-in").addEventListener("click", signIn);
    document.getElementById("sign-out").addEventListener("click", () => SERVICE.signOutAdmin());
    document.getElementById("export-csv").addEventListener("click", exportCsv);
    document.getElementById("print-admin").addEventListener("click", () => window.print());
    dongSelect.addEventListener("change", () => {
      cancelLineEdit();
      state.dong = dongSelect.value;
      renderAdmin();
    });
    statusSelect.addEventListener("change", () => {
      state.status = statusSelect.value;
      renderAdmin();
    });
    document.getElementById("start-add-line").addEventListener("click", startAddLine);
    document.getElementById("admin-landmark-toggle").addEventListener("change", (event) => {
      if (!map || !landmarkLayer) return;
      if (event.target.checked) landmarkLayer.addTo(map);
      else map.removeLayer(landmarkLayer);
    });
    document.getElementById("redraw-line").addEventListener("click", redrawSelectedLine);
    document.getElementById("undo-point").addEventListener("click", undoLastPoint);
    document.getElementById("cancel-line-edit").addEventListener("click", cancelLineEdit);
    document.getElementById("delete-line").addEventListener("click", deleteSelectedLine);
    document.getElementById("save-line").addEventListener("click", saveSelectedLine);
    document.getElementById("close-report-edit").addEventListener("click", closeReportEditor);
    document.getElementById("cancel-report-edit").addEventListener("click", closeReportEditor);
    document.getElementById("relocate-report").addEventListener("click", startReportRelocation);
    document.getElementById("cancel-report-relocation").addEventListener("click", cancelReportRelocation);
    reportForm.addEventListener("submit", saveReportEdit);
    reportDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeReportEditor();
    });
  }

  async function startAuthentication() {
    if (!SERVICE.isConfigured()) {
      document.getElementById("auth-title").textContent = "시범 관리자 화면";
      document.getElementById("auth-message").textContent = "Firebase 연결 전이라 이 브라우저의 시범 의견만 표시합니다.";
      document.getElementById("sign-in").textContent = "시범 관리자 화면 열기";
    }
    await SERVICE.onAuthChanged(handleAuthState);
  }

  async function signIn() {
    const button = document.getElementById("sign-in");
    button.disabled = true;
    button.textContent = "로그인 중…";
    try {
      const result = await SERVICE.signInAdmin();
      if (result && result.user && result.user.demo) await handleAuthState(result.user);
    } catch (error) {
      showAuthMessage("로그인하지 못했습니다. 다시 시도해주세요.");
    } finally {
      button.disabled = false;
      button.textContent = SERVICE.isConfigured() ? "Google 계정으로 로그인" : "시범 관리자 화면 열기";
    }
  }

  async function handleAuthState(user) {
    if (!user) {
      state.user = null;
      showAuthGate();
      return;
    }

    showAuthMessage("관리자 권한을 확인하고 있습니다.");
    try {
      const allowed = await SERVICE.checkAdmin(user);
      if (!allowed) {
        showPermissionDenied(user);
        return;
      }
      state.user = user;
      await showAdminApp();
    } catch (error) {
      showAuthMessage("관리자 권한을 확인하지 못했습니다. Firestore 보안 설정을 확인해주세요.");
    }
  }

  function showAuthGate() {
    authGate.hidden = false;
    adminApp.hidden = true;
    document.getElementById("sign-in").hidden = false;
    document.getElementById("sign-out").hidden = true;
    document.getElementById("admin-email").hidden = true;
    document.getElementById("admin-setup-info").hidden = true;
  }

  function showPermissionDenied(user) {
    authGate.hidden = false;
    adminApp.hidden = true;
    document.getElementById("auth-title").textContent = "관리자 등록이 필요합니다";
    document.getElementById("auth-message").textContent = `${user.email || "현재 계정"}은 아직 관리자 명단에 없습니다.`;
    document.getElementById("sign-in").hidden = true;
    document.getElementById("sign-out").hidden = false;
    const info = document.getElementById("admin-setup-info");
    info.hidden = false;
    info.innerHTML = `<strong>Firebase에서 추가할 관리자 문서</strong><br>컬렉션: admins<br>문서 ID: ${escapeHtml(user.uid)}<br>필드: active = true`;
  }

  async function showAdminApp() {
    authGate.hidden = true;
    adminApp.hidden = false;
    const email = document.getElementById("admin-email");
    email.textContent = state.user.email || "시범 관리자";
    email.hidden = false;
    document.getElementById("sign-out").hidden = Boolean(state.user.demo);

    if (!map) createMap();
    setTimeout(() => map.invalidateSize(), 0);
    await Promise.all([subscribeReports(), subscribeFeatures()]);
  }

  function createMap() {
    map = L.map("admin-map", { zoomControl: true, minZoom: 11, maxZoom: 19 });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
    }).addTo(map);
    officialLayer = L.layerGroup().addTo(map);
    landmarkLayer = L.layerGroup().addTo(map);
    featureLayer = L.layerGroup().addTo(map);
    reportLayer = L.layerGroup().addTo(map);
    editLayer = L.layerGroup().addTo(map);
    map.on("click", handleAdminMapClick);
    const updateLabels = () => map.getContainer().classList.toggle("show-landmark-labels", map.getZoom() >= 15);
    map.on("zoomend", updateLabels);
    updateLabels();
  }

  async function subscribeReports() {
    if (state.unsubscribeReports) state.unsubscribeReports();
    const notice = document.getElementById("admin-connection-notice");
    try {
      state.unsubscribeReports = await SERVICE.listenReports((reports) => {
        state.reports = reports;
        notice.classList.add("is-connected");
        notice.innerHTML = SERVICE.isConfigured()
          ? "<strong>공동 자료 저장소 연결</strong><span>새 의견과 처리상태가 실시간으로 반영됩니다.</span>"
          : "<strong>시범 실행 중</strong><span>Firebase 설정 전이라 이 브라우저의 시범 의견만 표시합니다.</span>";
        renderAdmin();
      }, () => {
        notice.innerHTML = "<strong>자료를 불러오지 못했습니다</strong><span>관리자 권한과 인터넷 연결을 확인해주세요.</span>";
      });
    } catch (error) {
      notice.innerHTML = "<strong>자료를 불러오지 못했습니다</strong><span>관리자 권한과 Firestore 설정을 확인해주세요.</span>";
    }
  }

  async function subscribeFeatures() {
    if (state.unsubscribeFeatures) state.unsubscribeFeatures();
    try {
      state.unsubscribeFeatures = await SERVICE.listenMapFeatures((features) => {
        state.featureOverrides = features;
        renderAdmin();
      }, () => showToast("최신 안전시설 선을 불러오지 못했습니다."));
    } catch (_) {
      showToast("최신 안전시설 선을 불러오지 못했습니다.");
    }
  }

  function filteredReports() {
    return state.reports.filter((report) => {
      const dongMatch = state.dong === "all" || report.dong === state.dong;
      const statusMatch = state.status === "deleted"
        ? report.deleted
        : !report.deleted && (state.status === "all" || report.status === state.status);
      return dongMatch && statusMatch;
    });
  }

  function renderAdmin() {
    if (!map) return;
    const reports = filteredReports();
    officialLayer.clearLayers();
    landmarkLayer.clearLayers();
    featureLayer.clearLayers();
    reportLayer.clearLayers();
    const visibleDongs = state.dong === "all" ? DATA.dongs : [getDong(state.dong)];
    const boundaries = visibleDongs.map((dong) => drawDong(dong));
    visibleDongs.forEach((dong) => drawLandmarks(dong, state.dong === "all"));

    reports.forEach((report) => {
      const marker = createReportMarker(report).addTo(reportLayer);
      marker.on("click", () => highlightCard(report.id));
    });

    if (!state.editMode && state.dong === "all") {
      const bounds = L.latLngBounds(DATA.dongs.flatMap((dong) => toLatLngs(dong.boundary)));
      map.fitBounds(bounds, { padding: [20, 20] });
    } else if (!state.editMode && boundaries[0]) {
      map.fitBounds(boundaries[0].getBounds(), { padding: [22, 22] });
    }

    const activeReports = state.reports.filter((item) => !item.deleted);
    document.getElementById("stat-total").textContent = String(activeReports.length);
    document.getElementById("stat-reviewing").textContent = String(activeReports.filter((item) => item.status === "reviewing").length);
    document.getElementById("stat-reflected").textContent = String(activeReports.filter((item) => item.status === "reflected").length);
    document.getElementById("admin-report-count").textContent = `${reports.length}건`;
    renderList(reports);
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

  function drawDong(dong) {
    const boundary = L.polygon(toLatLngs(dong.boundary), {
      color: "#405b66",
      weight: state.dong === "all" ? 2 : 4,
      dashArray: "10 7",
      fill: false,
      lineJoin: "round"
    }).bindTooltip(dong.name, { sticky: true }).addTo(officialLayer);

    getLineFeatures(dong).forEach(drawEditableFeature);
    return boundary;
  }

  function drawLandmarks(dong, compact) {
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
          html: `<div class="landmark-marker ${escapeHtml(item.category)}${compact ? " compact" : ""}"><span class="landmark-dot">${symbol}</span><span class="landmark-label">${escapeHtml(item.name)}</span></div>`,
          iconSize: compact ? [15, 15] : [27, 27],
          iconAnchor: compact ? [7, 7] : [13, 13]
        })
      }).addTo(landmarkLayer);
    });
  }

  function getLineFeatures(dong) {
    const base = [];
    dong.returnRoutes.forEach((item, index) => {
      const segment = normalizeSegments(item.segments)[0] || [];
      base.push({
        id: baseFeatureId("return", dong.name, index),
        type: "return",
        geometry: "line",
        dong: dong.name,
        name: item.name,
        location: item.location || "",
        points: segment.map((point) => ({ lat: Number(point.lat), lon: Number(point.lon) })),
        active: true,
        baseFeature: true
      });
    });
    dong.safetyAlleys.forEach((item, index) => {
      const isLine = item.kind === "line";
      const savedPoint = item.point || item;
      const segment = isLine
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
        points: segment.map((point) => ({ lat: Number(point.lat), lon: Number(point.lon) })),
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

  function drawEditableFeature(feature) {
    const selected = state.selectedFeature && state.selectedFeature.id === feature.id;
    const color = FEATURE_COLORS[feature.type] || FEATURE_COLORS.return;
    const symbol = FEATURE_SYMBOLS[feature.type] || "□";
    if (feature.geometry === "point") {
      const point = feature.points[0];
      const marker = L.marker([point.lat, point.lon], {
        icon: L.divIcon({
          className: "leaflet-div-icon",
          html: `<div class="official-marker ${feature.type}${selected ? " selected" : ""}">${symbol}</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        })
      }).bindTooltip(`${symbol} ${feature.name}`, { sticky: true }).addTo(featureLayer);
      marker.on("click", (event) => {
        L.DomEvent.stopPropagation(event.originalEvent);
        selectFeature(feature);
      });
      return;
    }
    const line = L.polyline(feature.points.map((point) => [point.lat, point.lon]), {
      color,
      weight: selected ? 8 : 5,
      opacity: selected ? 1 : .88
    }).bindTooltip(`${symbol} ${feature.name}`, { sticky: true }).addTo(featureLayer);
    line.on("click", (event) => {
      L.DomEvent.stopPropagation(event.originalEvent);
      selectFeature(feature);
    });
  }

  function cloneFeature(feature) {
    return {
      ...feature,
      points: feature.points.map((point) => ({ lat: Number(point.lat), lon: Number(point.lon) }))
    };
  }

  function selectFeature(feature) {
    if (state.editMode === "drawing") {
      showToast("현재 그리기를 저장하거나 취소한 뒤 다른 선을 선택해주세요.");
      return;
    }
    state.selectedFeature = cloneFeature(feature);
    state.featureBefore = cloneFeature(feature);
    state.editMode = "editing";
    openLineEditor(false);
    renderEditLayer();
    renderAdmin();
  }

  function startAddLine() {
    if (state.dong === "all") {
      showToast("먼저 행정동을 하나 선택해주세요.");
      dongSelect.focus();
      return;
    }
    const requestedType = document.getElementById("feature-type").value;
    const type = FEATURE_LABELS[requestedType] ? requestedType : "return";
    state.selectedFeature = {
      id: `custom__${state.dong}__${Date.now()}`,
      type,
      geometry: ["parcel", "vending"].includes(type) ? "point" : "line",
      dong: state.dong,
      name: "",
      location: "",
      points: [],
      active: true,
      baseFeature: false
    };
    state.featureBefore = null;
    state.editMode = "drawing";
    openLineEditor(true);
    renderEditLayer();
  }

  function openLineEditor(isNew) {
    const feature = state.selectedFeature;
    const typeLabel = FEATURE_LABELS[feature.type] || "안전시설";
    document.getElementById("line-editor-panel").hidden = false;
    document.getElementById("selected-feature-label").textContent = isNew ? `새 ${typeLabel}` : `${feature.dong} · ${feature.name}`;
    document.getElementById("feature-name").value = feature.name || "";
    document.getElementById("feature-location").value = feature.location || "";
    document.getElementById("delete-line").hidden = isNew;
    document.getElementById("line-edit-help").textContent = feature.geometry === "point"
      ? (isNew ? "지도를 확대하고 시설이 있는 위치를 한 번 눌러주세요." : "주황색 위치점을 끌어서 조정하거나 위치를 다시 지정하세요.")
      : (isNew ? "지도를 확대하고 이동 경로를 따라 점을 차례로 눌러주세요." : "주황색 점을 손가락이나 마우스로 끌어 위치를 조정하거나, 다시 그리기를 선택하세요.");
    document.getElementById("redraw-line").textContent = feature.geometry === "point" ? "위치 다시 지정" : "다시 그리기";
    document.getElementById("undo-point").hidden = feature.geometry === "point";
    const instruction = document.getElementById("line-edit-instruction");
    instruction.textContent = feature.geometry === "point"
      ? "지도에서 시설이 있는 위치를 한 번 눌러주세요."
      : "지도에서 경로를 따라 점을 차례로 눌러주세요.";
    instruction.hidden = state.editMode !== "drawing";
    document.querySelector(".admin-map-shell").classList.add("is-editing");
    setTimeout(() => map.invalidateSize(), 0);
  }

  function redrawSelectedLine() {
    if (!state.selectedFeature) return;
    state.selectedFeature.points = [];
    state.editMode = "drawing";
    document.getElementById("line-edit-instruction").hidden = false;
    document.getElementById("line-edit-help").textContent = state.selectedFeature.geometry === "point"
      ? "지도에서 시설이 있는 위치를 한 번 눌러주세요."
      : "지도에서 이동 경로를 따라 점을 차례로 눌러주세요.";
    renderEditLayer();
  }

  function handleAdminMapClick(event) {
    if (state.relocatingReport && state.editingReport) {
      state.editingReport.lat = Number(event.latlng.lat.toFixed(7));
      state.editingReport.lon = Number(event.latlng.lng.toFixed(7));
      state.relocatingReport = false;
      document.getElementById("line-edit-instruction").hidden = true;
      document.getElementById("cancel-report-relocation").hidden = true;
      document.querySelector(".admin-map-shell").classList.remove("is-editing");
      renderReportEditMarker();
      updateReportCoordinates();
      reportDialog.showModal();
      return;
    }
    handleLineMapClick(event);
  }

  function handleLineMapClick(event) {
    if (state.editMode !== "drawing" || !state.selectedFeature) return;
    const point = {
      lat: Number(event.latlng.lat.toFixed(7)),
      lon: Number(event.latlng.lng.toFixed(7))
    };
    if (state.selectedFeature.geometry === "point") {
      state.selectedFeature.points = [point];
      state.editMode = "editing";
      document.getElementById("line-edit-instruction").hidden = true;
      document.getElementById("line-edit-help").textContent = "주황색 위치점을 끌어서 조정한 뒤 저장하세요.";
    } else {
      state.selectedFeature.points.push(point);
    }
    renderEditLayer();
  }

  function undoLastPoint() {
    if (state.editMode !== "drawing" || !state.selectedFeature || !state.selectedFeature.points.length) return;
    state.selectedFeature.points.pop();
    renderEditLayer();
  }

  function renderEditLayer() {
    editLayer.clearLayers();
    const feature = state.selectedFeature;
    if (!feature) return;
    const points = feature.points;
    if (feature.geometry === "line" && points.length >= 2) {
      L.polyline(points.map((point) => [point.lat, point.lon]), {
        color: "#df6b3f",
        weight: 7,
        opacity: .95,
        dashArray: state.editMode === "drawing" ? "10 7" : null
      }).addTo(editLayer);
    }
    points.forEach((point, index) => {
      const marker = L.marker([point.lat, point.lon], {
        draggable: state.editMode === "editing",
        keyboard: false,
        icon: L.divIcon({
          className: "leaflet-div-icon",
          html: '<div class="edit-vertex"></div>',
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        })
      }).addTo(editLayer);
      marker.on("dragend", () => {
        const latlng = marker.getLatLng();
        feature.points[index] = {
          lat: Number(latlng.lat.toFixed(7)),
          lon: Number(latlng.lng.toFixed(7))
        };
        renderEditLayer();
      });
    });
    document.getElementById("point-count").textContent = feature.geometry === "point"
      ? (points.length ? "위치 지정됨" : "위치 미지정")
      : `${points.length}개 점`;
    document.getElementById("undo-point").disabled = state.editMode !== "drawing" || points.length === 0;
  }

  async function saveSelectedLine() {
    const feature = state.selectedFeature;
    if (!feature) return;
    const name = document.getElementById("feature-name").value.trim();
    const location = document.getElementById("feature-location").value.trim();
    if (!name) {
      showToast("시설 이름을 입력해주세요.");
      document.getElementById("feature-name").focus();
      return;
    }
    const minimumPoints = feature.geometry === "point" ? 1 : 2;
    if (feature.points.length < minimumPoints) {
      showToast(feature.geometry === "point" ? "지도에 시설 위치를 지정해주세요." : "지도에 점을 두 개 이상 찍어주세요.");
      return;
    }
    feature.name = name;
    feature.location = location;
    feature.active = true;
    const typeLabel = FEATURE_LABELS[feature.type] || "안전시설";
    if (!window.confirm(`${feature.dong} ${typeLabel} '${name}'을(를) 저장할까요?\n저장하면 시민참여단 지도에 자동 반영됩니다.`)) return;

    const button = document.getElementById("save-line");
    button.disabled = true;
    button.textContent = "저장 중…";
    try {
      await SERVICE.saveMapFeature(feature, state.featureBefore, state.user.email || "");
      upsertFeatureOverride(feature);
      cancelLineEdit();
      showToast("안전시설을 저장했습니다.");
    } catch (_) {
      showToast("안전시설을 저장하지 못했습니다. 관리자 권한과 보안 규칙을 확인해주세요.");
    } finally {
      button.disabled = false;
      button.textContent = "확인 후 저장";
    }
  }

  async function deleteSelectedLine() {
    const feature = state.selectedFeature;
    if (!feature) return;
    if (!state.featureBefore) {
      cancelLineEdit();
      return;
    }
    if (!window.confirm(`'${feature.name}' 시설을 지도에서 삭제할까요?\n삭제 내용도 시민참여단 지도에 자동 반영됩니다.`)) return;
    const deleted = { ...cloneFeature(feature), active: false };
    try {
      await SERVICE.saveMapFeature(deleted, state.featureBefore, state.user.email || "");
      upsertFeatureOverride(deleted);
      cancelLineEdit();
      showToast("안전시설을 삭제했습니다.");
    } catch (_) {
      showToast("안전시설을 삭제하지 못했습니다. 관리자 권한과 보안 규칙을 확인해주세요.");
    }
  }

  function upsertFeatureOverride(feature) {
    const saved = cloneFeature(feature);
    const index = state.featureOverrides.findIndex((item) => item.id === saved.id);
    if (index >= 0) state.featureOverrides[index] = saved;
    else state.featureOverrides.push(saved);
  }

  function cancelLineEdit() {
    state.selectedFeature = null;
    state.featureBefore = null;
    state.editMode = null;
    document.getElementById("line-editor-panel").hidden = true;
    document.getElementById("line-edit-instruction").hidden = true;
    document.getElementById("cancel-report-relocation").hidden = true;
    const shell = document.querySelector(".admin-map-shell");
    if (shell) shell.classList.remove("is-editing");
    if (editLayer) editLayer.clearLayers();
    if (map) renderAdmin();
  }

  function createReportMarker(report) {
    const color = TYPE_COLORS[report.type] || TYPE_COLORS.other;
    return L.marker([report.lat, report.lon], {
      icon: L.divIcon({
        className: "leaflet-div-icon",
        html: `<div class="citizen-marker" style="background:${color}"></div>`,
        iconSize: [27, 27],
        iconAnchor: [13, 13]
      })
    }).bindPopup(`<strong>${escapeHtml(report.dong)} · ${escapeHtml(TYPE_LABELS[report.type] || "기타")}</strong><br>${escapeHtml(report.note)}<br><small>${escapeHtml(STATUS_LABELS[report.status] || "접수")}</small>`);
  }

  function renderList(reports) {
    const container = document.getElementById("admin-report-list");
    if (!reports.length) {
      container.innerHTML = '<div class="empty-state">조건에 해당하는 의견이 없습니다.</div>';
      return;
    }
    container.innerHTML = reports.map((report) => `
      <article class="admin-report-card${report.deleted ? " is-deleted" : ""}" data-id="${escapeHtml(report.id)}">
        <div class="report-card-head">
          <span class="type-badge">${escapeHtml(report.dong)} · ${escapeHtml(TYPE_LABELS[report.type] || "기타")}</span>
          <span class="status-badge">${report.deleted ? "삭제됨" : escapeHtml(STATUS_LABELS[report.status] || "접수")}</span>
        </div>
        <p>${escapeHtml(report.note)}</p>
        <div class="report-meta"><span>${formatDate(report.createdAt)}</span><span>${Number(report.lat).toFixed(5)}, ${Number(report.lon).toFixed(5)}</span></div>
        ${report.deleted ? `
          <div class="report-admin-actions">
            <button type="button" class="secondary-button restore-report" data-id="${escapeHtml(report.id)}">의견 복구</button>
          </div>` : `
          <label class="select-label">
            <span>처리 상태</span>
            <select class="status-select" data-id="${escapeHtml(report.id)}">
              ${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}"${report.status === value ? " selected" : ""}>${label}</option>`).join("")}
            </select>
          </label>
          <div class="report-admin-actions">
            <button type="button" class="secondary-button edit-report" data-id="${escapeHtml(report.id)}">내용·위치 수정</button>
            <button type="button" class="danger-button remove-report" data-id="${escapeHtml(report.id)}">삭제</button>
          </div>`}
      </article>`).join("");

    container.querySelectorAll(".admin-report-card").forEach((card) => {
      card.addEventListener("click", (event) => {
        if (event.target.matches("select, option, button")) return;
        const report = state.reports.find((item) => item.id === card.dataset.id);
        if (report) map.setView([report.lat, report.lon], 17);
      });
    });
    container.querySelectorAll(".status-select").forEach((select) => {
      select.addEventListener("change", () => updateStatus(select.dataset.id, select.value, select));
    });
    container.querySelectorAll(".edit-report").forEach((button) => {
      button.addEventListener("click", () => openReportEditor(button.dataset.id));
    });
    container.querySelectorAll(".remove-report").forEach((button) => {
      button.addEventListener("click", () => setReportDeleted(button.dataset.id, true));
    });
    container.querySelectorAll(".restore-report").forEach((button) => {
      button.addEventListener("click", () => setReportDeleted(button.dataset.id, false));
    });
  }

  async function updateStatus(id, status, select) {
    if (!STATUS_LABELS[status]) return;
    select.disabled = true;
    try {
      await SERVICE.updateReportStatus(id, status, state.user.email || "");
      if (!SERVICE.isConfigured()) {
        const report = state.reports.find((item) => item.id === id);
        if (report) report.status = status;
        renderAdmin();
      }
      showToast(`처리 상태를 '${STATUS_LABELS[status]}'으로 변경했습니다.`);
    } catch (error) {
      showToast("처리 상태를 변경하지 못했습니다.");
      renderAdmin();
    } finally {
      select.disabled = false;
    }
  }

  function openReportEditor(id) {
    const report = state.reports.find((item) => item.id === id && !item.deleted);
    if (!report) return;
    cancelLineEdit();
    state.editingReport = { ...report };
    document.getElementById("edit-report-dong").value = report.dong;
    document.getElementById("edit-report-type").value = report.type;
    document.getElementById("edit-report-status").value = report.status;
    document.getElementById("edit-report-note").value = report.note;
    updateReportCoordinates();
    renderReportEditMarker();
    map.setView([report.lat, report.lon], Math.max(map.getZoom(), 17));
    reportDialog.showModal();
  }

  function closeReportEditor() {
    if (reportDialog.open) reportDialog.close();
    state.editingReport = null;
    state.relocatingReport = false;
    document.getElementById("line-edit-instruction").hidden = true;
    document.getElementById("cancel-report-relocation").hidden = true;
    document.querySelector(".admin-map-shell").classList.remove("is-editing");
    if (editLayer) editLayer.clearLayers();
  }

  function startReportRelocation() {
    if (!state.editingReport) return;
    reportDialog.close();
    state.relocatingReport = true;
    document.getElementById("line-edit-instruction").textContent = "의견의 새 위치를 지도에서 한 번 눌러주세요.";
    document.getElementById("line-edit-instruction").hidden = false;
    document.getElementById("cancel-report-relocation").hidden = false;
    document.querySelector(".admin-map-shell").classList.add("is-editing");
    showToast("지도에서 새 위치를 눌러주세요.");
  }

  function cancelReportRelocation() {
    if (!state.editingReport) return;
    state.relocatingReport = false;
    document.getElementById("line-edit-instruction").hidden = true;
    document.getElementById("cancel-report-relocation").hidden = true;
    document.querySelector(".admin-map-shell").classList.remove("is-editing");
    reportDialog.showModal();
  }

  function renderReportEditMarker() {
    if (!editLayer || !state.editingReport) return;
    editLayer.clearLayers();
    const marker = L.marker([state.editingReport.lat, state.editingReport.lon], {
      draggable: true,
      icon: L.divIcon({
        className: "leaflet-div-icon",
        html: '<div class="edit-report-marker">●</div>',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      })
    }).addTo(editLayer);
    marker.on("dragend", () => {
      const point = marker.getLatLng();
      state.editingReport.lat = Number(point.lat.toFixed(7));
      state.editingReport.lon = Number(point.lng.toFixed(7));
      updateReportCoordinates();
    });
  }

  function updateReportCoordinates() {
    if (!state.editingReport) return;
    document.getElementById("edit-report-coordinates").textContent = `${state.editingReport.lat.toFixed(6)}, ${state.editingReport.lon.toFixed(6)}`;
  }

  async function saveReportEdit(event) {
    event.preventDefault();
    if (!state.editingReport) return;
    const changes = {
      dong: document.getElementById("edit-report-dong").value,
      type: document.getElementById("edit-report-type").value,
      status: document.getElementById("edit-report-status").value,
      note: document.getElementById("edit-report-note").value.trim(),
      lat: state.editingReport.lat,
      lon: state.editingReport.lon
    };
    if (!changes.note) {
      showToast("의견 내용을 입력해주세요.");
      return;
    }
    const submit = reportForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = "저장 중…";
    try {
      await SERVICE.updateReport(state.editingReport.id, changes, state.user.email || "");
      const report = state.reports.find((item) => item.id === state.editingReport.id);
      if (report) Object.assign(report, changes, { reviewerEmail: state.user.email || "", updatedAt: new Date().toISOString() });
      closeReportEditor();
      renderAdmin();
      showToast("시민참여단 의견을 수정했습니다.");
    } catch (_) {
      showToast("의견을 수정하지 못했습니다. 보안 규칙을 확인해주세요.");
    } finally {
      submit.disabled = false;
      submit.textContent = "수정 내용 저장";
    }
  }

  async function setReportDeleted(id, deleted) {
    const report = state.reports.find((item) => item.id === id);
    if (!report) return;
    const question = deleted
      ? "이 의견을 삭제할까요? 삭제된 의견 화면에서 다시 복구할 수 있습니다."
      : "이 의견을 다시 복구할까요?";
    if (!window.confirm(question)) return;
    try {
      await SERVICE.setReportDeleted(id, deleted, state.user.email || "");
      report.deleted = deleted;
      report.deletedAt = deleted ? new Date().toISOString() : "";
      report.deletedBy = deleted ? (state.user.email || "") : "";
      renderAdmin();
      showToast(deleted ? "의견을 삭제했습니다. 필요하면 복구할 수 있습니다." : "의견을 복구했습니다.");
    } catch (_) {
      showToast(deleted ? "의견을 삭제하지 못했습니다." : "의견을 복구하지 못했습니다.");
    }
  }

  function highlightCard(id) {
    const card = [...document.querySelectorAll(".admin-report-card")].find((item) => item.dataset.id === id);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function exportCsv() {
    if (!state.reports.length) {
      showToast("내려받을 의견이 없습니다.");
      return;
    }
    const rows = [["번호", "행정동", "취약유형", "의견", "위도", "경도", "처리상태", "삭제여부", "등록일시", "처리담당"]];
    state.reports.forEach((report, index) => rows.push([
      index + 1,
      report.dong,
      TYPE_LABELS[report.type] || "기타",
      report.note,
      report.lat,
      report.lon,
      STATUS_LABELS[report.status] || "접수",
      report.deleted ? "삭제됨" : "사용 중",
      report.createdAt,
      report.reviewerEmail || ""
    ]));
    const csv = "\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `서구_마을안전지도_시민의견_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function csvCell(value) {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
  }

  function showAuthMessage(message) {
    document.getElementById("auth-message").textContent = message;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "등록 직후";
    return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
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
