(function () {
  "use strict";

  const H = window.Hamkke;
  const SERVICE = window.SafetyMapFirebase;
  const TAB_KEY = "seogu-safety-map-tab-v1";
  const CODE_KEY = "seogu-safety-map-hamkke-code-v1";
  const FILTER_KEY = "seogu-safety-map-hamkke-filter-v2";
  const esc = window.HamkkeForm.esc;

  const panel = document.getElementById("hamkke-view");
  const state = {
    code: "",
    stores: [],
    resultOf: () => undefined,
    stop: null,
    filter: readJson(FILTER_KEY, { division: "all", progress: "all", campaignOnly: true, query: "" }),
    form: null
  };

  function readJson(key, fallback) {
    try {
      return { ...fallback, ...(JSON.parse(localStorage.getItem(key) || "null") || {}) };
    } catch (_) {
      return { ...fallback };
    }
  }

  function store(key, value) {
    try { localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value)); } catch (_) { /* 무시 */ }
  }

  function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { toast.hidden = true; }, 3200);
  }

  // ── 하단 탭 ──
  function switchTab(tab) {
    document.querySelectorAll("[data-tab-panel]").forEach((section) => { section.hidden = section.dataset.tabPanel !== tab; });
    document.querySelectorAll(".bottom-tab").forEach((button) => {
      const active = button.dataset.tab === tab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    store(TAB_KEY, tab);
    document.dispatchEvent(new CustomEvent("safetymap:tabchange", { detail: tab }));
    if (tab === "hamkke" && !panel.dataset.ready) startHamkke();
  }

  document.querySelectorAll(".bottom-tab").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  // ── 함께가게 ──
  function startHamkke() {
    panel.dataset.ready = "1";
    state.form = window.HamkkeForm.create({ toast: showToast });
    let saved = "";
    try { saved = localStorage.getItem(CODE_KEY) || ""; } catch (_) { saved = ""; }
    if (saved) unlock(saved, true);
    else renderLock();
  }

  function renderLock(message) {
    panel.innerHTML = `
      <div class="hk-wrap">
        <section class="hk-lock">
          <div class="hk-lock-icon" aria-hidden="true">🤝</div>
          <p class="eyebrow">함께가게</p>
          <h1>현장 방문·전화 모니터링</h1>
          <p>시민참여단 전용 메뉴예요. 안내받은 접속코드를 입력해주세요.</p>
          <form class="hk-lock-form">
            <input type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="접속코드" aria-label="접속코드" required>
            <button type="submit" class="primary-button">확인</button>
          </form>
          <p class="hk-lock-message" role="alert">${message ? esc(message) : ""}</p>
        </section>
      </div>`;
    const form = panel.querySelector("form");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      unlock(form.querySelector("input").value.trim(), false);
    });
  }

  async function unlock(code, silent) {
    try {
      const ok = await SERVICE.hamkkeCheckCode(code);
      if (!ok) {
        try { localStorage.removeItem(CODE_KEY); } catch (_) { /* 무시 */ }
        renderLock(silent ? "" : "접속코드가 맞지 않아요. 다시 확인해주세요.");
        return;
      }
    } catch (error) {
      console.error(error);
      renderLock("인터넷 연결을 확인한 뒤 다시 시도해주세요.");
      return;
    }
    state.code = code;
    store(CODE_KEY, code);
    renderShell();
    if (state.stop) state.stop();
    state.stop = await SERVICE.listenHamkke(code, (stores) => {
      state.stores = stores.filter((item) => item.active !== false);
      renderList();
    }, (results) => {
      state.resultOf = H.indexResults(results);
      renderList();
    }, (error) => {
      console.error(error);
      showToast("명단을 불러오지 못했어요. 인터넷 연결을 확인해주세요.");
    });
  }

  function renderShell() {
    const f = state.filter;
    panel.innerHTML = `
      <div class="hk-wrap">
        <section class="hk-hero">
          <div>
            <p class="eyebrow">함께가게</p>
            <h1>현장 방문·전화 모니터링</h1>
          </div>
          <div class="hk-stats" data-hk="stats"></div>
        </section>
        <div class="hk-script-row">
          <button type="button" class="secondary-button" data-script="field">📋 현장 방문 대본</button>
          <button type="button" class="secondary-button" data-script="phone">📞 전화 대본</button>
        </div>
        <section class="hk-filters" aria-label="점포 찾기">
          <div class="hk-chip-row" data-hk="divisions">
            ${["all", ...H.DIVISIONS].map((division) => `
              <button type="button" class="hk-chip ${f.division === division ? "is-active" : ""}" data-division="${esc(division)}">${division === "all" ? "전체" : esc(division.replace("분과", ""))}</button>`).join("")}
          </div>
          <div class="hk-filter-line">
            <select data-hk="progress" aria-label="진행 상태">
              <option value="all">모든 상태</option>
              <option value="none">방문 전</option>
              <option value="visit">방문 완료</option>
              <option value="phone">전화 완료</option>
            </select>
            <label class="hk-toggle">
              <input type="checkbox" data-hk="campaign-only" ${f.campaignOnly ? "checked" : ""}>
              <span class="hk-toggle-track" aria-hidden="true"></span>
              <span>캠페인 1차만 보기</span>
            </label>
          </div>
          <input type="search" data-hk="query" placeholder="상호·대표자·주소 검색" value="${esc(f.query)}">
        </section>
        <div class="hk-list" data-hk="list"><p class="hk-empty">명단을 불러오는 중이에요…</p></div>
        <p class="hk-footer">결과는 저장하는 즉시 관리자에게 전달돼요.
          <button type="button" class="hk-link" data-hk-action="logout">접속코드 다시 입력</button></p>
      </div>`;
    panel.querySelector('[data-hk="progress"]').value = f.progress;

    panel.addEventListener("click", onPanelClick);
    panel.querySelector('[data-hk="progress"]').addEventListener("change", (event) => updateFilter({ progress: event.target.value }));
    panel.querySelector('[data-hk="campaign-only"]').addEventListener("change", (event) => updateFilter({ campaignOnly: event.target.checked }));
    panel.querySelector('[data-hk="query"]').addEventListener("input", (event) => updateFilter({ query: event.target.value }));
  }

  function onPanelClick(event) {
    const target = event.target;
    const chip = target.closest("[data-division]");
    if (chip) {
      panel.querySelectorAll("[data-division]").forEach((item) => item.classList.toggle("is-active", item === chip));
      updateFilter({ division: chip.dataset.division });
      return;
    }
    const script = target.closest("[data-script]");
    if (script) { state.form.openScript(script.dataset.script); return; }
    const open = target.closest("[data-open-store]");
    if (open) { openStore(open.dataset.openStore); return; }
    if (target.closest('[data-hk-action="logout"]')) {
      try { localStorage.removeItem(CODE_KEY); } catch (_) { /* 무시 */ }
      if (state.stop) state.stop();
      state.stop = null;
      panel.removeEventListener("click", onPanelClick);
      renderLock();
    }
  }

  function updateFilter(change) {
    state.filter = { ...state.filter, ...change };
    store(FILTER_KEY, { ...state.filter, query: "" });
    renderList();
  }


  function renderList() {
    const list = panel.querySelector('[data-hk="list"]');
    if (!list) return;
    const f = state.filter;
    const query = f.query.trim().replace(/\s+/g, "");
    const scoped = H.sortStores(state.stores).filter((item) => !f.campaignOnly || item.campaign === "1차");
    const byDivision = scoped.filter((item) => f.division === "all" || item.division === f.division);
    const shown = byDivision.filter((item) => {
      const progress = H.progressOf(state.resultOf(item));
      if (f.progress !== "all" && progress !== f.progress) return false;
      if (!query) return true;
      return [item.name, item.owner, item.address, item.dong].join("").replace(/\s+/g, "").includes(query);
    });

    const counts = { none: 0, visit: 0, phone: 0 };
    byDivision.forEach((item) => { counts[H.progressOf(state.resultOf(item))] += 1; });
    panel.querySelector('[data-hk="stats"]').innerHTML = `
      <span><b>${byDivision.length}</b>${f.campaignOnly ? "1차 대상" : "전체"}</span>
      <span><b>${counts.visit + counts.phone}</b>방문 완료</span>
      <span><b>${counts.phone}</b>전화 완료</span>`;

    if (!state.stores.length) {
      list.innerHTML = '<p class="hk-empty">아직 등록된 점포 명단이 없어요. 담당자에게 문의해주세요.</p>';
      return;
    }
    if (!shown.length) {
      list.innerHTML = '<p class="hk-empty">조건에 맞는 점포가 없어요.</p>';
      return;
    }
    list.innerHTML = shown.map((item) => storeCard(item, state.resultOf(item))).join("");
  }

  function storeCard(item, result) {
    const progress = H.progressOf(result);
    const tel = H.telHref(item.phone);
    const mapUrl = `https://map.kakao.com/link/search/${encodeURIComponent(`광주 서구 ${item.name}`)}`;
    const visit = (result && result.visit) || {};
    const visited = progress !== "none" && visit.date ? `방문 ${H.formatKoreanDate(visit.date)}` : "";
    const campaign = H.CAMPAIGN_LABELS[item.campaign || ""] || "";
    const frameClass = { "배부완료": "is-delivered", "1차 행사 수령": "is-event", "액자 보관 중": "is-kept" }[item.frame] || "";
    return `
      <article class="hk-store">
        <div class="hk-store-top">
          <div class="hk-store-name">
            <strong>${esc(item.name)}</strong>
            <span class="hk-tags">
              ${campaign ? `<em class="hk-tag ${item.campaign === "1차" ? "is-campaign" : "is-next"}">${esc(campaign)}</em>` : ""}
              ${item.frame ? `<em class="hk-tag hk-frame ${frameClass}">${esc(item.frame)}</em>` : ""}
            </span>
          </div>
          <span class="hk-badge is-${progress}">${H.PROGRESS_LABELS[progress]}</span>
        </div>
        <dl class="hk-info">
          <div><dt>주소</dt><dd>${esc(item.address || "-")}</dd></div>
          <div><dt>대표자</dt><dd>${esc(item.owner || "-")}</dd></div>
          <div><dt>연락처</dt><dd>${tel ? `<a class="hk-tel" href="${tel}">${esc(item.phone)}</a>` : '<span class="hk-muted">확인 필요</span>'}</dd></div>
          ${item.note ? `<div><dt>비고</dt><dd class="hk-note-text">${esc(item.note)}</dd></div>` : ""}
        </dl>
        ${visited ? `<p class="hk-visited">${esc(visited)}</p>` : ""}
        <div class="hk-store-actions">
          ${tel
            ? `<a class="hk-action hk-call" href="${tel}">📞 전화</a>`
            : '<span class="hk-action is-disabled">번호 없음</span>'}
          <a class="hk-action" href="${mapUrl}" target="_blank" rel="noopener">📍 지도</a>
          <button type="button" class="hk-action hk-primary" data-open-store="${esc(item.id)}">${progress === "none" ? "결과 입력" : "결과 보기·수정"}</button>
        </div>
      </article>`;
  }

  function openStore(id) {
    const item = state.stores.find((entry) => entry.id === id);
    if (!item) return;
    state.form.open({
      store: item,
      result: state.resultOf(item) || {},
      code: state.code,
      onSave: (section, data, target) => SERVICE.saveHamkkeSection(state.code, target, section, data, "시민참여단")
    });
  }

  let initial = "map";
  try { initial = localStorage.getItem(TAB_KEY) === "hamkke" ? "hamkke" : "map"; } catch (_) { initial = "map"; }
  switchTab(initial);
})();
