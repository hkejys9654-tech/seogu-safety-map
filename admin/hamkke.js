(function () {
  "use strict";

  const H = window.Hamkke;
  const SERVICE = window.SafetyMapFirebase;
  const HW = window.HamkkeHwpx;
  const esc = window.HamkkeForm.esc;
  const CODE_KEY = "seogu-safety-map-hamkke-admin-code-v1";
  const TEMPLATE_URL = "../hamkke/result-template.hwpx?v=20261015-1";
  const ROSTER_HEADERS = ["분과", "번호", "구분", "분과장", "상호명", "대표자", "연락처", "주소", "행정동", "업종"];

  const root = document.getElementById("hk-admin");
  const state = {
    code: "",
    stores: [],
    results: new Map(),
    stop: null,
    filter: { division: "all", scope: "visit", progress: "all" },
    form: window.HamkkeForm.create({ toast: showToast, prefillToday: false })
  };

  function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { toast.hidden = true; }, 3400);
  }

  function todayStamp() {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // ── 접속코드 ──
  function renderGate(message, allowStart) {
    root.innerHTML = `
      <div class="hk-wrap">
        <section class="hk-lock">
          <div class="hk-lock-icon" aria-hidden="true">🤝</div>
          <p class="eyebrow">함께가게 관리자</p>
          <h1>결과 관리 화면</h1>
          <p>시민참여단과 같은 접속코드를 입력해주세요.</p>
          <form class="hk-lock-form">
            <input type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="접속코드" aria-label="접속코드" required>
            <button type="submit" class="primary-button">확인</button>
          </form>
          <p class="hk-lock-message" role="alert">${message ? esc(message) : ""}</p>
          ${allowStart ? `
            <div class="hk-start">
              <p>처음 시작한다면 명단 엑셀을 올려주세요. 올리면 이 코드로 함께가게 메뉴가 열립니다.</p>
              <label class="secondary-button hk-file-button">명단 엑셀 올리기<input type="file" accept=".xlsx,.xls" data-hk="start-upload" hidden></label>
            </div>` : ""}
        </section>
      </div>`;
    const form = root.querySelector("form");
    const input = form.querySelector("input");
    if (allowStart) input.value = allowStart;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      unlock(input.value.trim());
    });
    const upload = root.querySelector('[data-hk="start-upload"]');
    if (upload) upload.addEventListener("change", async () => {
      const code = input.value.trim();
      if (!/^[0-9]{4,8}$/.test(code)) { showToast("접속코드는 숫자 4~8자리로 입력해주세요."); return; }
      const count = await importRoster(upload.files[0], code);
      if (count) unlock(code);
    });
  }

  async function unlock(code) {
    if (!/^[0-9]{4,8}$/.test(code)) { renderGate("접속코드는 숫자 4~8자리예요."); return; }
    let ok = false;
    try {
      ok = await SERVICE.hamkkeCheckCode(code);
    } catch (error) {
      console.error(error);
      renderGate("인터넷 연결을 확인한 뒤 다시 시도해주세요.");
      return;
    }
    if (!ok) {
      renderGate("이 코드로 등록된 명단이 없어요.", code);
      return;
    }
    state.code = code;
    try { localStorage.setItem(CODE_KEY, code); } catch (_) { /* 무시 */ }
    renderMain();
    if (state.stop) state.stop();
    state.stop = await SERVICE.listenHamkke(code, (stores) => {
      state.stores = stores.filter((item) => item.active !== false);
      renderBody();
    }, (results) => {
      state.results = new Map(results.map((item) => [item.storeId || item.id, item]));
      renderBody();
    }, (error) => {
      console.error(error);
      showToast("자료를 불러오지 못했어요. 인터넷 연결을 확인해주세요.");
    });
  }

  // ── 화면 ──
  function renderMain() {
    const f = state.filter;
    root.innerHTML = `
      <div class="view-heading admin-heading admin-hero hk-admin-hero">
        <div>
          <p class="eyebrow">함께가게</p>
          <h1>현장 방문·전화 모니터링 결과</h1>
          <p class="heading-description" data-hk="summary">명단을 불러오는 중입니다.</p>
        </div>
        <div class="admin-actions hk-admin-actions">
          <button type="button" class="primary-button" data-act="hwpx-all">한글 내려받기 (한 파일)</button>
          <button type="button" class="secondary-button" data-act="hwpx-zip">점포별 한글 묶음</button>
          <button type="button" class="secondary-button" data-act="xlsx">엑셀 현황</button>
        </div>
      </div>

      <div class="hk-admin-stats" data-hk="stats"></div>

      <section class="admin-control-panel hk-admin-controls" aria-label="조회 조건">
        <div class="admin-filters hk-admin-filters">
          <label class="select-label"><span>분과</span>
            <select data-filter="division">
              <option value="all">전체 분과</option>
              ${H.DIVISIONS.map((d) => `<option value="${esc(d)}">${esc(d)}</option>`).join("")}
            </select>
          </label>
          <label class="select-label"><span>범위</span>
            <select data-filter="scope">
              <option value="visit">방문 대상만</option>
              <option value="all">배부완료 포함</option>
            </select>
          </label>
          <label class="select-label"><span>진행 상태</span>
            <select data-filter="progress">
              <option value="all">모든 상태</option>
              <option value="none">방문 전</option>
              <option value="visit">방문 완료</option>
              <option value="phone">전화 완료</option>
            </select>
          </label>
        </div>
        <div class="hk-roster-tools">
          <button type="button" class="secondary-button" data-act="roster-download">명단 엑셀 내려받기</button>
          <label class="secondary-button hk-file-button">명단 엑셀 올리기<input type="file" accept=".xlsx,.xls" data-hk="upload" hidden></label>
        </div>
        <p class="hk-admin-help">한글 파일은 붙임2 서식 그대로 채워집니다. 입력 전인 점포는 상호·주소만 들어간 빈 서식으로 나옵니다. 명단을 다시 올려도 이미 입력된 결과는 그대로 남습니다.</p>
      </section>

      <div class="hk-table-wrap">
        <table class="hk-table">
          <thead><tr>
            <th>분과</th><th>번호</th><th>상호명</th><th>대표자·연락처</th><th>상태</th><th>방문일</th><th>전화 확인</th><th>작업</th>
          </tr></thead>
          <tbody data-hk="rows"><tr><td colspan="8" class="hk-empty-cell">불러오는 중…</td></tr></tbody>
        </table>
      </div>`;

    root.querySelectorAll("[data-filter]").forEach((select) => {
      select.value = f[select.dataset.filter];
      select.addEventListener("change", () => {
        state.filter[select.dataset.filter] = select.value;
        renderBody();
      });
    });
    root.querySelector('[data-hk="upload"]').addEventListener("change", async (event) => {
      await importRoster(event.target.files[0], state.code);
      event.target.value = "";
    });
    if (!root.dataset.bound) {
      root.addEventListener("click", onClick);
      root.dataset.bound = "1";
    }
  }

  function filteredStores() {
    const f = state.filter;
    const order = (division) => {
      const index = H.DIVISIONS.indexOf(division);
      return index < 0 ? 99 : index;
    };
    return state.stores
      .filter((item) => f.scope === "all" || item.round === "visit")
      .filter((item) => f.division === "all" || item.division === f.division)
      .filter((item) => f.progress === "all" || H.progressOf(state.results.get(item.id)) === f.progress)
      .sort((a, b) => order(a.division) - order(b.division)
        || (a.round === b.round ? 0 : a.round === "visit" ? -1 : 1)
        || (Number(a.no) || 0) - (Number(b.no) || 0));
  }

  function renderBody() {
    const rows = root.querySelector('[data-hk="rows"]');
    if (!rows) return;
    const visitStores = state.stores.filter((item) => item.round === "visit");
    const summary = root.querySelector('[data-hk="summary"]');
    summary.textContent = `명단 ${state.stores.length}곳 (방문 대상 ${visitStores.length}곳 · 배부완료 ${state.stores.length - visitStores.length}곳)`;

    root.querySelector('[data-hk="stats"]').innerHTML = H.DIVISIONS.map((division) => {
      const list = visitStores.filter((item) => item.division === division);
      const progress = list.map((item) => H.progressOf(state.results.get(item.id)));
      const visited = progress.filter((p) => p !== "none").length;
      const phoned = progress.filter((p) => p === "phone").length;
      const leader = (list[0] || {}).leader || "";
      return `
        <article>
          <span>${esc(division)}${leader ? ` · ${esc(leader)}` : ""}</span>
          <strong>${visited}<small> / ${list.length}곳 방문</small></strong>
          <em>전화 완료 ${phoned}곳</em>
        </article>`;
    }).join("");

    const list = filteredStores();
    if (!list.length) {
      rows.innerHTML = `<tr><td colspan="8" class="hk-empty-cell">${state.stores.length ? "조건에 맞는 점포가 없습니다." : "등록된 명단이 없습니다. 명단 엑셀을 올려주세요."}</td></tr>`;
      return;
    }
    rows.innerHTML = list.map((item) => {
      const result = state.results.get(item.id) || {};
      const progress = H.progressOf(result);
      const visit = result.visit || {};
      const phone = result.phone || {};
      return `
        <tr>
          <td>${esc(item.division.replace("분과", ""))}</td>
          <td>${esc(item.no)}${item.round === "done" ? '<br><small class="hk-muted">배부완료</small>' : ""}</td>
          <td><strong>${esc(item.name)}</strong><br><small class="hk-muted">${esc(item.address)}</small></td>
          <td>${esc(item.owner)}<br><small class="hk-muted">${esc(item.phone || "연락처 없음")}</small></td>
          <td><span class="hk-badge is-${progress}">${H.PROGRESS_LABELS[progress]}</span></td>
          <td>${visit.date ? esc(H.formatKoreanDate(visit.date)) : "-"}</td>
          <td>${phone.date ? `${esc(H.formatKoreanDate(phone.date))}<br><small class="hk-muted">${esc(phone.callResult || "")}</small>` : "-"}</td>
          <td class="hk-row-actions">
            <button type="button" class="secondary-button" data-act="edit" data-id="${esc(item.id)}">보기·수정</button>
            <button type="button" class="secondary-button" data-act="hwpx-one" data-id="${esc(item.id)}">한글</button>
          </td>
        </tr>`;
    }).join("");
  }

  async function onClick(event) {
    const button = event.target.closest("[data-act]");
    if (!button) return;
    const act = button.dataset.act;
    const store = state.stores.find((item) => item.id === button.dataset.id);
    if (act === "edit" && store) {
      state.form.open({
        store,
        result: state.results.get(store.id) || {},
        code: state.code,
        onSave: (section, data, target) => SERVICE.saveHamkkeSection(state.code, target, section, data, "관리자")
      });
      return;
    }
    const busyLabel = button.textContent;
    button.disabled = true;
    button.textContent = "만드는 중…";
    try {
      if (act === "hwpx-one" && store) await downloadHwpx([store], `함께가게_결과_${HW.safeFileName(store.name)}.hwpx`);
      if (act === "hwpx-all") await downloadHwpx(filteredStores(), `함께가게_결과_${filterLabel()}_${todayStamp()}.hwpx`);
      if (act === "hwpx-zip") await downloadZip(filteredStores());
      if (act === "xlsx") downloadStatus(filteredStores());
      if (act === "roster-download") downloadRoster();
    } catch (error) {
      console.error(error);
      showToast("파일을 만들지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      button.disabled = false;
      button.textContent = busyLabel;
    }
  }

  function filterLabel() {
    return state.filter.division === "all" ? "전체" : state.filter.division;
  }

  // ── 한글 ──
  function recordsFor(stores) {
    return stores.map((store) => ({ store, result: state.results.get(store.id) || null }));
  }

  async function downloadHwpx(stores, name) {
    if (!stores.length) { showToast("내려받을 점포가 없어요."); return; }
    const template = await HW.loadTemplate(TEMPLATE_URL);
    const zip = await HW.build(template, recordsFor(stores));
    const blob = await zip.generateAsync({ type: "blob", mimeType: "application/hwp+zip" });
    download(blob, name);
    showToast(`${stores.length}곳을 한글 파일로 내려받았어요.`);
  }

  async function downloadZip(stores) {
    if (!stores.length) { showToast("내려받을 점포가 없어요."); return; }
    const template = await HW.loadTemplate(TEMPLATE_URL);
    const bundle = new window.JSZip();
    for (const store of stores) {
      const zip = await HW.build(template, recordsFor([store]));
      const data = await zip.generateAsync({ type: "uint8array" });
      bundle.file(`${String(store.no).padStart(2, "0")}_${HW.safeFileName(store.division)}_${HW.safeFileName(store.name)}.hwpx`, data);
    }
    download(await bundle.generateAsync({ type: "blob" }), `함께가게_결과_${filterLabel()}_${todayStamp()}.zip`);
    showToast(`${stores.length}곳 파일을 묶어서 내려받았어요.`);
  }

  // ── 엑셀 ──
  function list(value) {
    return Array.isArray(value) ? value.join(", ") : String(value || "");
  }

  function downloadStatus(stores) {
    if (!stores.length) { showToast("내려받을 점포가 없어요."); return; }
    const rows = stores.map((store) => {
      const result = state.results.get(store.id) || {};
      const v = result.visit || {};
      const p = result.phone || {};
      return {
        분과: store.division,
        번호: store.no,
        구분: store.round === "done" ? "배부완료" : "방문 대상",
        상호명: store.name,
        대표자: store.owner,
        연락처: store.phone,
        주소: store.address,
        행정동: store.dong,
        진행상태: H.PROGRESS_LABELS[H.progressOf(result)],
        업종: v.category || store.category || "",
        방문일: v.date || "",
        방문시간: v.time || "",
        조장: v.leader || "",
        팀원: v.members || "",
        취지안내: v.guide || "",
        실천약속서명: v.pledgeSign || "",
        액자전달: v.frameDelivery || "",
        액자게시: v.framePosting || "",
        소통방: v.chatroom || "",
        우선실천약속: v.priority === "기타" ? `기타: ${v.priorityOther || ""}` : (v.priority || ""),
        필요지원: list(v.support) + (list(v.support).includes("기타") && v.supportOther ? ` (${v.supportOther})` : ""),
        주요의견: v.opinion || "",
        한줄소감: v.comment || "",
        사진촬영: v.photo || "",
        영상촬영: v.video || "",
        홍보활용: list(v.promo),
        동의성명: v.consentName || "",
        전화확인일: p.date || "",
        확인자: p.checker || "",
        통화결과: p.callResult || "",
        실천여부: p.practice || "",
        실천사례애로사항: p.practiceDetail || "",
        후속조치: p.followUp === "재통화" && p.recallDate ? `재통화(${p.recallDate})` : (p.followUp || ""),
        작성자: p.writer || "",
        최종수정: result.updatedAt ? new Date(result.updatedAt).toLocaleString("ko-KR") : ""
      };
    });
    const sheet = window.XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = Object.keys(rows[0]).map((key) => ({ wch: ["상호명", "주소", "주요의견", "실천사례애로사항", "우선실천약속"].includes(key) ? 30 : 12 }));
    sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    const book = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(book, sheet, "함께가게 결과");
    window.XLSX.writeFile(book, `함께가게_결과현황_${filterLabel()}_${todayStamp()}.xlsx`);
  }

  function downloadRoster() {
    const rows = [...state.stores]
      .sort((a, b) => H.DIVISIONS.indexOf(a.division) - H.DIVISIONS.indexOf(b.division)
        || (a.round === b.round ? 0 : a.round === "visit" ? -1 : 1)
        || (Number(a.no) || 0) - (Number(b.no) || 0))
      .map((s) => [s.division, s.no, s.round === "done" ? "배부완료" : "방문 대상", s.leader, s.name, s.owner, s.phone, s.address, s.dong, s.category]);
    const sheet = window.XLSX.utils.aoa_to_sheet([ROSTER_HEADERS, ...rows]);
    sheet["!cols"] = [12, 6, 10, 8, 34, 8, 15, 34, 9, 12].map((wch) => ({ wch }));
    const book = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(book, sheet, "함께가게 명단");
    window.XLSX.writeFile(book, `함께가게_명단_${todayStamp()}.xlsx`);
  }

  async function importRoster(file, code) {
    if (!file) return 0;
    try {
      const book = window.XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = book.Sheets[book.SheetNames[0]];
      const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
      if (!rows.length || !("상호명" in rows[0]) || !("분과" in rows[0])) {
        showToast("첫 줄에 '분과', '상호명' 제목이 있는 명단 양식을 올려주세요.");
        return 0;
      }
      const skipped = [];
      const stores = [];
      rows.forEach((row, index) => {
        const name = String(row["상호명"] || "").trim();
        const division = String(row["분과"] || "").trim();
        if (!name) return;
        if (!H.DIVISIONS.includes(division)) { skipped.push(`${index + 2}행(${name})`); return; }
        stores.push({
          id: H.storeIdFor(name),
          division,
          no: Number(row["번호"]) || 0,
          round: String(row["구분"] || "").includes("배부완료") ? "done" : "visit",
          leader: String(row["분과장"] || "").trim(),
          name,
          owner: String(row["대표자"] || "").trim(),
          phone: String(row["연락처"] || "").trim(),
          address: String(row["주소"] || "").trim(),
          dong: String(row["행정동"] || "").trim(),
          category: String(row["업종"] || "").trim()
        });
      });
      if (!stores.length) { showToast("올릴 점포를 찾지 못했어요."); return 0; }
      const visitCount = stores.filter((s) => s.round === "visit").length;
      const message = `${stores.length}곳을 명단에 올릴까요?\n(방문 대상 ${visitCount}곳 · 배부완료 ${stores.length - visitCount}곳)`
        + (skipped.length ? `\n\n분과 이름이 맞지 않아 빠지는 줄: ${skipped.join(", ")}` : "");
      if (!window.confirm(message)) return 0;
      const count = await SERVICE.saveHamkkeStores(code, stores);
      showToast(`명단 ${count}곳을 올렸어요.`);
      return count;
    } catch (error) {
      console.error(error);
      showToast("명단을 올리지 못했어요. 파일 형식을 확인해주세요.");
      return 0;
    }
  }

  let saved = "";
  try { saved = localStorage.getItem(CODE_KEY) || ""; } catch (_) { saved = ""; }
  if (saved) unlock(saved);
  else renderGate();
})();
