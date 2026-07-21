(function () {
  "use strict";

  const DATA = window.SAFETY_MAP_DATA;
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

  if (!DATA || !Array.isArray(DATA.dongs) || typeof L === "undefined" || !SERVICE) {
    document.body.innerHTML = "<p style='padding:24px'>관리자 앱을 불러오지 못했습니다. 인터넷 연결과 파일 구성을 확인해주세요.</p>";
    return;
  }

  const state = {
    reports: [],
    dong: "all",
    status: "all",
    user: null,
    unsubscribeReports: null
  };

  const authGate = document.getElementById("auth-gate");
  const adminApp = document.getElementById("admin-app");
  const dongSelect = document.getElementById("admin-dong");
  const statusSelect = document.getElementById("admin-status");
  let map = null;
  let officialLayer = null;
  let reportLayer = null;

  populateDongSelect();
  bindEvents();
  startAuthentication();

  function populateDongSelect() {
    DATA.dongs.forEach((dong) => dongSelect.add(new Option(dong.name, dong.name)));
  }

  function bindEvents() {
    document.getElementById("sign-in").addEventListener("click", signIn);
    document.getElementById("sign-out").addEventListener("click", () => SERVICE.signOutAdmin());
    document.getElementById("export-csv").addEventListener("click", exportCsv);
    document.getElementById("print-admin").addEventListener("click", () => window.print());
    dongSelect.addEventListener("change", () => {
      state.dong = dongSelect.value;
      renderAdmin();
    });
    statusSelect.addEventListener("change", () => {
      state.status = statusSelect.value;
      renderAdmin();
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
    await subscribeReports();
  }

  function createMap() {
    map = L.map("admin-map", { zoomControl: true, minZoom: 11, maxZoom: 19 });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);
    officialLayer = L.layerGroup().addTo(map);
    reportLayer = L.layerGroup().addTo(map);
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

  function filteredReports() {
    return state.reports.filter((report) => {
      const dongMatch = state.dong === "all" || report.dong === state.dong;
      const statusMatch = state.status === "all" || report.status === state.status;
      return dongMatch && statusMatch;
    });
  }

  function renderAdmin() {
    if (!map) return;
    const reports = filteredReports();
    officialLayer.clearLayers();
    reportLayer.clearLayers();
    const visibleDongs = state.dong === "all" ? DATA.dongs : [getDong(state.dong)];
    const boundaries = visibleDongs.map((dong) => drawDong(dong));

    reports.forEach((report) => {
      const marker = createReportMarker(report).addTo(reportLayer);
      marker.on("click", () => highlightCard(report.id));
    });

    if (state.dong === "all") {
      const bounds = L.latLngBounds(DATA.dongs.flatMap((dong) => toLatLngs(dong.boundary)));
      map.fitBounds(bounds, { padding: [20, 20] });
    } else if (boundaries[0]) {
      map.fitBounds(boundaries[0].getBounds(), { padding: [22, 22] });
    }

    document.getElementById("stat-total").textContent = String(state.reports.length);
    document.getElementById("stat-reviewing").textContent = String(state.reports.filter((item) => item.status === "reviewing").length);
    document.getElementById("stat-reflected").textContent = String(state.reports.filter((item) => item.status === "reflected").length);
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

    dong.returnRoutes.forEach((item) => {
      normalizeSegments(item.segments).forEach((segment) => {
        L.polyline(toLatLngs(segment), { color: "#596caf", weight: 4, opacity: .85 })
          .bindPopup(`<strong>□ ${escapeHtml(item.name)}</strong><br>${escapeHtml(item.location || "")}`)
          .addTo(officialLayer);
      });
    });
    dong.safetyAlleys.forEach((item) => {
      if (item.kind === "line") {
        normalizeSegments(item.segments).forEach((segment) => {
          L.polyline(toLatLngs(segment), { color: "#2e8b62", weight: 4, opacity: .85 })
            .bindPopup(`<strong>○ ${escapeHtml(item.name)}</strong>`)
            .addTo(officialLayer);
        });
      }
    });
    return boundary;
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
      <article class="admin-report-card" data-id="${escapeHtml(report.id)}">
        <div class="report-card-head">
          <span class="type-badge">${escapeHtml(report.dong)} · ${escapeHtml(TYPE_LABELS[report.type] || "기타")}</span>
          <span class="status-badge">${escapeHtml(STATUS_LABELS[report.status] || "접수")}</span>
        </div>
        <p>${escapeHtml(report.note)}</p>
        <div class="report-meta"><span>${formatDate(report.createdAt)}</span><span>${Number(report.lat).toFixed(5)}, ${Number(report.lon).toFixed(5)}</span></div>
        <label class="select-label">
          <span>처리 상태</span>
          <select class="status-select" data-id="${escapeHtml(report.id)}">
            ${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}"${report.status === value ? " selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
      </article>`).join("");

    container.querySelectorAll(".admin-report-card").forEach((card) => {
      card.addEventListener("click", (event) => {
        if (event.target.matches("select, option")) return;
        const report = state.reports.find((item) => item.id === card.dataset.id);
        if (report) map.setView([report.lat, report.lon], 17);
      });
    });
    container.querySelectorAll(".status-select").forEach((select) => {
      select.addEventListener("change", () => updateStatus(select.dataset.id, select.value, select));
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

  function highlightCard(id) {
    const card = [...document.querySelectorAll(".admin-report-card")].find((item) => item.dataset.id === id);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function exportCsv() {
    if (!state.reports.length) {
      showToast("내려받을 의견이 없습니다.");
      return;
    }
    const rows = [["번호", "행정동", "취약유형", "의견", "위도", "경도", "처리상태", "등록일시", "처리담당"]];
    state.reports.forEach((report, index) => rows.push([
      index + 1,
      report.dong,
      TYPE_LABELS[report.type] || "기타",
      report.note,
      report.lat,
      report.lon,
      STATUS_LABELS[report.status] || "접수",
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
