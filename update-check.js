(function () {
  "use strict";

  // 새 버전이 배포되면 화면을 자동으로 새로 불러옵니다.
  // 빌드할 때 <meta name="app-build">에 배포 번호가 들어가고, version.json과 비교합니다.
  const meta = document.querySelector('meta[name="app-build"]');
  const current = meta ? meta.getAttribute("content") : "";
  if (!current || current.startsWith("__")) return;

  const script = document.currentScript;
  const versionUrl = new URL("version.json", script ? script.src : location.href);
  const TRIED_KEY = "seogu-safety-map-reload-tried";
  const CHECK_EVERY = 5 * 60 * 1000;
  let pending = "";

  function busy() {
    // 입력 창이 열려 있거나 지도에서 위치를 고르는 중이면 기다립니다.
    return Boolean(document.querySelector("dialog[open]"))
      || Boolean(document.querySelector(".map-instruction:not([hidden])"));
  }

  function reloadTo(build) {
    let tried = "";
    try { tried = sessionStorage.getItem(TRIED_KEY) || ""; } catch (_) { tried = ""; }
    if (tried === build) return; // 같은 번호로 이미 한 번 시도했다면 반복하지 않습니다.
    try { sessionStorage.setItem(TRIED_KEY, build); } catch (_) { /* 무시 */ }
    const url = new URL(location.href);
    url.searchParams.set("_v", build.slice(0, 12));
    location.replace(url.toString());
  }

  async function check() {
    if (pending) {
      if (!busy()) reloadTo(pending);
      return;
    }
    try {
      const response = await fetch(`${versionUrl.href}?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      const latest = String(data.build || "");
      if (!latest || latest === current) return;
      pending = latest;
      if (!busy()) reloadTo(latest);
    } catch (_) {
      // 연결이 없으면 다음 확인 때 다시 봅니다.
    }
  }

  check();
  setInterval(check, CHECK_EVERY);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
  document.addEventListener("close", () => { if (pending) setTimeout(check, 300); }, true);
})();
