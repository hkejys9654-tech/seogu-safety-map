(function (global) {
  "use strict";

  const H = global.Hamkke;
  const DRAFT_PREFIX = "hamkke-draft-v1";

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function today() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  function choiceGroup(name, options, type, extraClass) {
    return `<div class="hk-choices ${extraClass || ""}" role="group">${options.map((option) => `
      <label class="hk-choice"><input type="${type}" name="${name}" value="${esc(option)}"><span>${esc(option)}</span></label>`).join("")}
    </div>`;
  }

  function field(label, control, hint) {
    return `<label class="hk-field"><span class="hk-label">${label}</span>${control}${hint ? `<small>${hint}</small>` : ""}</label>`;
  }

  function scriptHtml(blocks) {
    return blocks.map((block) => `
      <section class="hk-script-block">
        <h3><span>${esc(block.role)}</span>${esc(block.title)}</h3>
        ${block.lines.map((line) => `<p>${esc(line)}</p>`).join("")}
      </section>`).join("");
  }

  function buildDialog() {
    const dialog = document.createElement("dialog");
    dialog.className = "report-dialog sheet-dialog hk-dialog";
    dialog.id = "hamkke-form-dialog";
    dialog.innerHTML = `
      <form class="hk-form" novalidate>
        <div class="hk-form-head">
          <div class="dialog-heading">
            <div>
              <p class="eyebrow" data-hk="division">분과</p>
              <h2 data-hk="title">점포</h2>
              <p class="hk-sub" data-hk="address"></p>
            </div>
            <button type="button" class="icon-button" data-hk-action="close" aria-label="닫기">×</button>
          </div>
          <div class="hk-segment" role="tablist">
            <button type="button" role="tab" data-hk-section="visit" class="is-active">방문 기록 <small>1~4</small></button>
            <button type="button" role="tab" data-hk-section="phone">전화 모니터링 <small>5</small></button>
          </div>
        </div>

        <div class="hk-form-body">
          <p class="hk-draft-note" data-hk="draft" hidden>작성 중이던 내용을 불러왔어요. 저장을 눌러야 전송됩니다.</p>

          <div class="hk-section" data-hk-panel="visit">
            <button type="button" class="hk-script-button" data-hk-script="field">📋 현장 방문 대본 보기</button>

            <fieldset class="hk-card">
              <legend>1. 활동 개요</legend>
              <div class="hk-grid-2">
                ${field("방문일", `<input type="date" name="visit.date">`)}
                ${field("방문 시간", `<input type="time" name="visit.time">`)}
              </div>
              ${field("업종", `<input type="text" name="visit.category" maxlength="40" placeholder="예: 음식점, 세탁소">`)}
              <div class="hk-grid-2">
                ${field("조장(분과장)", `<input type="text" name="visit.leader" maxlength="20">`)}
                ${field("팀원", `<input type="text" name="visit.members" maxlength="60" placeholder="예: 홍길동, 김영희">`)}
              </div>
            </fieldset>

            <fieldset class="hk-card">
              <legend>2. 현장 활동 확인</legend>
              ${H.VISIT_CHECKS.map((check) => `
                <div class="hk-row">
                  <span class="hk-label">${esc(check.label)}</span>
                  ${choiceGroup(`visit.${check.key}`, check.options, "radio")}
                </div>`).join("")}
              <div class="hk-row hk-row-block">
                <span class="hk-label">점주가 선택한 우선 실천 약속 <em>(한 가지)</em></span>
                ${choiceGroup("visit.priority", H.PRIORITY_OPTIONS, "radio", "hk-choices-stack")}
                <input type="text" name="visit.priorityOther" maxlength="80" placeholder="기타를 고르면 내용을 적어주세요" class="hk-other">
              </div>
            </fieldset>

            <fieldset class="hk-card">
              <legend>3. 현장 의견 및 지원 수요</legend>
              <div class="hk-row hk-row-block">
                <span class="hk-label">필요 지원 <em>(여러 개 선택)</em></span>
                ${choiceGroup("visit.support", H.SUPPORT_OPTIONS, "checkbox")}
                <input type="text" name="visit.supportOther" maxlength="80" placeholder="기타 지원 내용" class="hk-other">
              </div>
              ${field("주요 의견", `<textarea name="visit.opinion" rows="3" maxlength="600" placeholder="사장님이 말씀하신 내용을 그대로 적어주세요"></textarea>`)}
              ${field("한 줄 소감", `<input type="text" name="visit.comment" maxlength="120">`)}
            </fieldset>

            <fieldset class="hk-card">
              <legend>4. 촬영 및 홍보 활용 동의 확인</legend>
              <div class="hk-row"><span class="hk-label">사진 촬영</span>${choiceGroup("visit.photo", H.PHOTO_OPTIONS, "radio")}</div>
              <div class="hk-row"><span class="hk-label">영상 촬영</span>${choiceGroup("visit.video", H.VIDEO_OPTIONS, "radio")}</div>
              <div class="hk-row"><span class="hk-label">홍보 활용 <em>(여러 개 선택)</em></span>${choiceGroup("visit.promo", H.PROMO_OPTIONS, "checkbox")}</div>
              ${field("동의 확인 성명", `<input type="text" name="visit.consentName" maxlength="20" placeholder="동의하신 분 성함">`, "서명은 종이 결과보고서에 받아주세요.")}
              <p class="hk-note">※ 홍보 활용 미동의 시 촬영하지 않으며, 동의 여부는 사업 참여에 영향을 주지 않음.</p>
            </fieldset>

            <button type="button" class="primary-button hk-save" data-hk-save="visit">방문 기록 저장</button>
          </div>

          <div class="hk-section" data-hk-panel="phone" hidden>
            <button type="button" class="hk-script-button" data-hk-script="phone">📞 전화 모니터링 대본 보기</button>
            <p class="hk-priority-ref" data-hk="priorityRef"></p>

            <fieldset class="hk-card">
              <legend>5. 전화 모니터링 및 후속조치</legend>
              <div class="hk-grid-2">
                ${field("확인일", `<input type="date" name="phone.date">`)}
                ${field("확인자", `<input type="text" name="phone.checker" maxlength="20">`)}
              </div>
              <div class="hk-row"><span class="hk-label">통화 결과</span>${choiceGroup("phone.callResult", H.CALL_OPTIONS, "radio")}</div>
              <div class="hk-row hk-row-block"><span class="hk-label">실천 여부</span>${choiceGroup("phone.practice", H.PRACTICE_OPTIONS, "radio")}</div>
              ${field("구체적 실천 사례·애로사항", `<textarea name="phone.practiceDetail" rows="3" maxlength="600" placeholder="답변을 유도하지 않고 그대로 적어주세요"></textarea>`)}
              <div class="hk-row hk-row-block">
                <span class="hk-label">후속조치</span>
                ${choiceGroup("phone.followUp", H.FOLLOW_OPTIONS, "radio")}
                <label class="hk-field hk-recall" hidden><span class="hk-label">재통화 예정일</span><input type="date" name="phone.recallDate"></label>
              </div>
              ${field("작성자(조장)", `<input type="text" name="phone.writer" maxlength="20">`)}
            </fieldset>

            <button type="button" class="primary-button hk-save" data-hk-save="phone">전화 모니터링 저장</button>
          </div>
        </div>
      </form>`;
    document.body.appendChild(dialog);

    const scriptDialog = document.createElement("dialog");
    scriptDialog.className = "report-dialog sheet-dialog hk-script-dialog";
    scriptDialog.innerHTML = `
      <div class="sheet-body">
        <div class="dialog-heading">
          <div><p class="eyebrow">시민참여단 대본</p><h2 data-hk="scriptTitle">현장 방문 대본</h2></div>
          <button type="button" class="icon-button" data-hk-action="close-script" aria-label="닫기">×</button>
        </div>
        <div class="hk-script" data-hk="script"></div>
      </div>`;
    document.body.appendChild(scriptDialog);
    return { dialog, scriptDialog };
  }

  function create(options) {
    const settings = options || {};
    const { dialog, scriptDialog } = buildDialog();
    const form = dialog.querySelector("form");
    const state = { store: null, result: null, code: "", section: "visit", onSave: null, dirty: false };

    const q = (selector) => dialog.querySelector(selector);

    function draftKey(section) {
      return `${DRAFT_PREFIX}:${state.code}:${state.store ? state.store.id : ""}:${section}`;
    }

    function readDraft(section) {
      try {
        return JSON.parse(localStorage.getItem(draftKey(section)) || "null");
      } catch (_) {
        return null;
      }
    }

    function writeDraft(section) {
      try {
        localStorage.setItem(draftKey(section), JSON.stringify({ at: new Date().toISOString(), data: collect(section) }));
      } catch (_) {
        // 기기 저장이 막힌 경우에도 입력은 계속할 수 있습니다.
      }
    }

    function clearDraft(section) {
      try { localStorage.removeItem(draftKey(section)); } catch (_) { /* 무시 */ }
    }

    function collect(section) {
      const keys = section === "visit" ? H.VISIT_KEYS : H.PHONE_KEYS;
      const data = {};
      keys.forEach((key) => {
        if (key === "savedAt") return;
        const inputs = [...form.querySelectorAll(`[name="${section}.${key}"]`)];
        if (!inputs.length) return;
        if (inputs[0].type === "checkbox") data[key] = inputs.filter((input) => input.checked).map((input) => input.value);
        else if (inputs[0].type === "radio") data[key] = (inputs.find((input) => input.checked) || {}).value || "";
        else data[key] = inputs[0].value.trim();
      });
      return data;
    }

    function fill(section, data) {
      const values = data || {};
      const keys = section === "visit" ? H.VISIT_KEYS : H.PHONE_KEYS;
      keys.forEach((key) => {
        const inputs = [...form.querySelectorAll(`[name="${section}.${key}"]`)];
        if (!inputs.length) return;
        const value = values[key];
        if (inputs[0].type === "checkbox") {
          const list = Array.isArray(value) ? value : [];
          inputs.forEach((input) => { input.checked = list.includes(input.value); });
        } else if (inputs[0].type === "radio") {
          inputs.forEach((input) => { input.checked = input.value === value; });
        } else {
          inputs[0].value = value ?? "";
        }
      });
    }

    function syncConditional() {
      const priority = (form.querySelector('[name="visit.priority"]:checked') || {}).value;
      const priorityOther = form.querySelector('[name="visit.priorityOther"]');
      priorityOther.hidden = priority !== "기타";
      const supportOther = form.querySelector('[name="visit.supportOther"]');
      supportOther.hidden = !form.querySelector('[name="visit.support"][value="기타"]:checked');
      const follow = (form.querySelector('[name="phone.followUp"]:checked') || {}).value;
      q(".hk-recall").hidden = follow !== "재통화";
    }

    function setSection(section) {
      state.section = section;
      dialog.querySelectorAll("[data-hk-section]").forEach((button) => {
        const active = button.dataset.hkSection === section;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));
      });
      dialog.querySelectorAll("[data-hk-panel]").forEach((panel) => { panel.hidden = panel.dataset.hkPanel !== section; });
      const body = q(".hk-form-body");
      if (body) body.scrollTop = 0;
      updatePriorityRef();
    }

    function updatePriorityRef() {
      const visit = collect("visit");
      const ref = q('[data-hk="priorityRef"]');
      const priority = visit.priority === "기타" ? `기타: ${visit.priorityOther || ""}` : visit.priority;
      ref.textContent = priority ? `방문 때 고른 우선 실천약속: ‘${priority}’` : "방문 기록에서 고른 우선 실천약속이 아직 없어요.";
    }

    function open(params) {
      state.store = params.store;
      state.result = params.result || {};
      state.code = params.code || "";
      state.onSave = params.onSave;
      const store = state.store;
      q('[data-hk="division"]').textContent = [store.division, H.CAMPAIGN_LABELS[store.campaign || ""], H.frameOf(store.frame) ? `액자 ${H.frameOf(store.frame)}` : "", H.PROGRESS_LABELS[H.progressOf(state.result)]]
        .filter(Boolean).join(" · ");
      q('[data-hk="title"]').textContent = store.name;
      q('[data-hk="address"]').textContent = [store.address, store.dong].filter(Boolean).join(" · ");

      const visit = { ...(state.result.visit || {}) };
      if (!visit.date) visit.date = settings.prefillToday === false ? "" : today();
      if (!visit.leader) visit.leader = store.leader || "";
      if (!visit.category) visit.category = store.category || "";
      const phone = { ...(state.result.phone || {}) };
      if (!phone.writer) phone.writer = visit.leader || store.leader || "";
      if (!phone.date && (state.result.visit || {}).savedAt && settings.prefillToday !== false) phone.date = today();
      fill("visit", visit);
      fill("phone", phone);

      let restored = false;
      ["visit", "phone"].forEach((section) => {
        const draft = readDraft(section);
        const savedAt = (state.result[section] || {}).savedAt || "";
        if (draft && draft.data && (!savedAt || draft.at > savedAt)) {
          fill(section, draft.data);
          restored = true;
        }
      });
      q('[data-hk="draft"]').hidden = !restored;
      syncConditional();
      const startSection = params.section || (H.progressOf(state.result) === "none" ? "visit" : "phone");
      setSection(startSection);
      if (!dialog.open) dialog.showModal();
    }

    async function save(section) {
      const button = dialog.querySelector(`[data-hk-save="${section}"]`);
      const data = H.cleanSection({ ...collect(section), savedAt: new Date().toISOString() }, section === "visit" ? H.VISIT_KEYS : H.PHONE_KEYS);
      if (section === "visit" && !data.date) {
        settings.toast("방문일을 입력해주세요.");
        return;
      }
      if (section === "phone" && !data.callResult) {
        settings.toast("통화 결과를 골라주세요.");
        return;
      }
      button.disabled = true;
      const label = button.textContent;
      button.textContent = "저장 중…";
      try {
        const outcome = await state.onSave(section, data, state.store);
        if (outcome === "pending") {
          settings.toast("인터넷이 약해 전송을 기다리는 중이에요. 화면을 닫지 말고 잠시 기다려주세요.");
          return;
        }
        clearDraft(section);
        state.result = { ...state.result, [section]: data };
        q('[data-hk="draft"]').hidden = true;
        settings.toast(section === "visit" ? "방문 기록을 저장했어요." : "전화 모니터링을 저장했어요.");
        if (section === "visit") setSection("phone");
        else dialog.close();
      } catch (error) {
        console.error(error);
        settings.toast("저장하지 못했어요. 입력 내용은 이 휴대폰에 남아 있으니 잠시 후 다시 눌러주세요.");
      } finally {
        button.disabled = false;
        button.textContent = label;
      }
    }

    function openScript(kind) {
      scriptDialog.querySelector('[data-hk="scriptTitle"]').textContent = kind === "phone" ? "전화 모니터링 대본" : "현장 방문 대본";
      scriptDialog.querySelector('[data-hk="script"]').innerHTML = scriptHtml(kind === "phone" ? H.PHONE_SCRIPT : H.FIELD_SCRIPT);
      scriptDialog.showModal();
    }

    dialog.addEventListener("click", (event) => {
      const target = event.target;
      if (target === dialog) { dialog.close(); return; }
      const sectionButton = target.closest("[data-hk-section]");
      if (sectionButton) setSection(sectionButton.dataset.hkSection);
      const saveButton = target.closest("[data-hk-save]");
      if (saveButton) save(saveButton.dataset.hkSave);
      const scriptButton = target.closest("[data-hk-script]");
      if (scriptButton) openScript(scriptButton.dataset.hkScript);
      if (target.closest('[data-hk-action="close"]')) dialog.close();
    });
    form.addEventListener("submit", (event) => event.preventDefault());
    form.addEventListener("change", (event) => {
      const input = event.target;
      // 홍보 활용 '미동의'는 다른 항목과 함께 고를 수 없습니다.
      if (input.name === "visit.promo" && input.checked) {
        form.querySelectorAll('[name="visit.promo"]').forEach((other) => {
          if (other !== input && (input.value === "미동의" || other.value === "미동의")) other.checked = false;
        });
      }
      syncConditional();
    });
    form.addEventListener("input", (event) => {
      const name = event.target.name || "";
      const section = name.split(".")[0];
      if (section === "visit" || section === "phone") writeDraft(section);
    });
    form.addEventListener("change", (event) => {
      const name = event.target.name || "";
      const section = name.split(".")[0];
      if (section === "visit" || section === "phone") writeDraft(section);
    });
    scriptDialog.addEventListener("click", (event) => {
      if (event.target === scriptDialog || event.target.closest('[data-hk-action="close-script"]')) scriptDialog.close();
    });

    return { open, openScript, close: () => dialog.close(), get isOpen() { return dialog.open; } };
  }

  global.HamkkeForm = { create, esc };
})(window);
