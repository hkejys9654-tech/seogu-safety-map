(function () {
  "use strict";

  // 관리자 화면 배치: 폰에서는 하단 탭으로 '지도'와 '의견·편집'을 오가고, 범례는 접어 둡니다.
  const body = document.body;
  const narrow = window.matchMedia("(max-width: 900px)");
  const legend = document.getElementById("admin-legend");
  const legendToggle = document.getElementById("admin-legend-toggle");

  function setTab(tab) {
    body.dataset.adminTab = tab;
    document.querySelectorAll("[data-admin-tab]").forEach((button) => {
      if (button === body) return;
      const active = button.dataset.adminTab === tab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    if (tab === "map") document.dispatchEvent(new CustomEvent("safetymap:tabchange", { detail: "map" }));
    if (tab === "list") {
      const side = document.querySelector(".admin-side");
      if (side) side.scrollTop = 0;
    }
  }

  function setLegendOpen(open) {
    legend.hidden = !open;
    legendToggle.setAttribute("aria-expanded", String(open));
    legendToggle.classList.toggle("is-open", open);
  }

  document.querySelectorAll("button[data-admin-tab]").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.adminTab));
  });
  legendToggle.addEventListener("click", () => setLegendOpen(legend.hidden));
  document.addEventListener("admin:show-map", () => {
    if (narrow.matches && body.dataset.adminTab !== "map") setTab("map");
  });
  const onResize = () => document.dispatchEvent(new CustomEvent("safetymap:tabchange", { detail: "map" }));
  if (narrow.addEventListener) narrow.addEventListener("change", onResize);

  // 지도 위 편집 카드가 열리면 범례를 접어 겹치지 않게 합니다.
  const editCard = document.getElementById("line-editor-panel");
  if (editCard && window.MutationObserver) {
    new MutationObserver(() => { if (!editCard.hidden) setLegendOpen(false); })
      .observe(editCard, { attributes: true, attributeFilter: ["hidden"] });
  }

  // 인쇄할 때는 범례가 보이도록 잠시 펼칩니다.
  let legendWasHidden = true;
  window.addEventListener("beforeprint", () => { legendWasHidden = legend.hidden; legend.hidden = false; });
  window.addEventListener("afterprint", () => { legend.hidden = legendWasHidden; });
})();
