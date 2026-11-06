(function (global) {
  "use strict";

  // 함께가게 현장 방문 및 전화 모니터링 결과(붙임2) 공통 정의
  const DIVISIONS = ["돌봄분과", "양성평등분과", "안전분과", "일자리분과"];

  const VISIT_CHECKS = [
    { key: "guide", label: "사업 취지 및 실천약속 안내", options: ["완료", "미완료"] },
    { key: "pledgeSign", label: "실천약속 확인 및 서명", options: ["완료", "추후 확인"] },
    { key: "frameDelivery", label: "실천약속 액자 전달", options: ["전달", "미전달"] },
    { key: "framePosting", label: "액자 게시 상태", options: ["게시", "거치", "전달만"] },
    { key: "chatroom", label: "온라인 소통방 안내", options: ["참여", "미참여", "추후 결정"] }
  ];

  const PRIORITY_OPTIONS = [
    "종사자와 손님을 성별·나이·국적·장애와 관계없이 존중하기",
    "차별·비하 언어 사용하지 않기",
    "불편한 말·행동은 즉시 멈추기",
    "일과 가정이 조화를 이루고 모두가 안전하고 편안한 일터를 만들기",
    "기타"
  ];

  const SUPPORT_OPTIONS = ["SNS·온라인 홍보", "사진·영상", "메뉴·POP 디자인", "로고·브랜딩", "경영·상권분석", "기타"];
  const PHOTO_OPTIONS = ["동의", "미동의"];
  const VIDEO_OPTIONS = ["동의", "미동의", "해당 없음"];
  const PROMO_OPTIONS = ["소식지", "구청 SNS·블로그", "미동의"];
  const CALL_OPTIONS = ["통화 완료", "재통화 필요", "연락 안 됨"];
  const PRACTICE_OPTIONS = ["실천 중", "일부 실천·보완 필요", "미실천", "확인 곤란"];
  const FOLLOW_OPTIONS = ["없음", "재통화", "담당부서 연계"];

  const VISIT_KEYS = [
    "date", "time", "category", "leader", "members",
    "guide", "pledgeSign", "frameDelivery", "framePosting", "chatroom",
    "priority", "priorityOther", "support", "supportOther", "opinion", "comment",
    "photo", "video", "promo", "consentName", "savedAt"
  ];
  const PHONE_KEYS = [
    "date", "checker", "callResult", "practice", "practiceDetail",
    "followUp", "recallDate", "writer", "savedAt"
  ];

  const FIELD_SCRIPT = [
    {
      role: "조장",
      title: "인사·서명·약속 고르기",
      lines: [
        "“안녕하세요, 서구 여성친화도시 시민참여단입니다. 10분만 괜찮으실까요?”",
        "“함께가게 참여 감사드려요. 실천약속 액자 전해드리러 왔어요. 약속 같이 보고 서명 부탁드려요.”",
        "(서명 후) “이 중 가장 먼저 실천할 약속 하나만 골라주세요.”",
        "“가게 운영에 필요한 지원 있으면 편하게 말씀해 주세요.”",
        "“1~2달 뒤에 3분 정도 전화드릴게요.”"
      ]
    },
    {
      role: "팀원 1",
      title: "액자 놓기",
      lines: [
        "“손님 잘 보이는 곳 어디에 놓아드릴까요?”",
        "※ 원할 때만 부착"
      ]
    },
    {
      role: "팀원 2",
      title: "사진·한 말씀",
      lines: [
        "“기념사진 찍어도 될까요? 구청 홍보에 소개될 수 있어요.”",
        "(동의 시) “‘생활 속 평등, 함께가게!’ 손하트 부탁드려요.”",
        "“고르신 약속, 어떻게 실천하실지 한 말씀 부탁드려요.” (영상은 따로 동의받기)"
      ]
    },
    {
      role: "다같이",
      title: "마무리",
      lines: ["“참여해 주셔서 감사합니다. 번창하세요!”"]
    },
    {
      role: "상황별",
      title: "이럴 땐 이렇게",
      collapsed: true,
      lines: [
        "바쁠 때: “편한 시간에 다시 올게요.”",
        "사진 싫을 때: “괜찮아요, 액자만 드릴게요.”",
        "부착 싫을 때: “편한 곳에 두시면 돼요.”",
        "사장님 안 계실 때: “계신 시간에 다시 올게요.”"
      ]
    }
  ];

  const PHONE_SCRIPT = [
    { role: "①", title: "인사", lines: ["“시민참여단 ○○○입니다. 함께가게 약속 여쭤보려고 전화드렸어요. 3분 괜찮으세요?”"] },
    { role: "②", title: "약속 확인", lines: ["“고르신 약속 ‘○○○○’, 요즘 어떻게 하고 계세요?”"] },
    { role: "③", title: "사례·어려운 점", lines: ["“달라진 점이나 어려운 점 있으세요?”"] },
    { role: "④", title: "마무리", lines: ["“말씀 감사합니다. 번창하세요!”"] },
    { role: "※", title: "기록할 때", lines: ["답을 유도하지 말고 들은 그대로 적기. 안 받으면 다른 날 1번만 더 걸기."] }
  ];

  function storeIdFor(name) {
    // 상호명으로 늘 같은 번호를 만들어, 명단을 다시 올려도 기존 결과와 이어지게 합니다.
    let hash = 0x811c9dc5;
    const text = String(name || "").replace(/\s+/g, "");
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return `s${hash.toString(16).padStart(8, "0")}`;
  }

  // 캠페인 차수·액자 상태 (2026. 10. 21. 배부현황 대조 기준)
  const CAMPAIGN_LABELS = { "1차": "캠페인 1차", "2차 예정": "2차 명단 예정", "": "" };
  const FRAME_STATES = ["수령", "미수령"];
  // 예전 표기(배부완료·1차 행사 수령·액자 보관 중)도 수령/미수령으로 바꿔 읽습니다.
  function frameOf(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (text === "미수령" || text.includes("보관") || text.includes("미배부")) return "미수령";
    return "수령";
  }
  const CAMPAIGN_ORDER = { "1차": 0, "2차 예정": 1, "": 2 };

  function nameKey(name) {
    return String(name || "").replace(/\s+/g, "");
  }

  // 결과는 점포 번호로 찾고, 없으면 상호명으로 찾아 명단이 바뀌어도 이어서 보이게 합니다.
  function indexResults(results) {
    const byId = new Map();
    const byName = new Map();
    results.forEach((item) => {
      byId.set(item.storeId || item.id, item);
      if (item.storeName) byName.set(nameKey(item.storeName), item);
    });
    return (store) => (store ? byId.get(store.id) || byName.get(nameKey(store.name)) : undefined);
  }

  function sortStores(stores) {
    const division = (value) => {
      const index = DIVISIONS.indexOf(value);
      return index < 0 ? 99 : index;
    };
    return [...stores].sort((a, b) => division(a.division) - division(b.division)
      || (CAMPAIGN_ORDER[a.campaign || ""] ?? 2) - (CAMPAIGN_ORDER[b.campaign || ""] ?? 2)
      || (Number(a.no) || 0) - (Number(b.no) || 0));
  }

  function progressOf(result) {
    const visit = result && result.visit;
    const phone = result && result.phone;
    if (phone && phone.savedAt && phone.callResult === "통화 완료") return "phone";
    if (visit && visit.savedAt && visit.date) return "visit";
    return "none";
  }

  const DIVISION_KEYS = { "돌봄분과": "care", "양성평등분과": "equal", "안전분과": "safe", "일자리분과": "job" };
  function divisionClass(division) { return `hk-div-${DIVISION_KEYS[division] || "etc"}`; }

  const PROGRESS_LABELS = { none: "방문 전", visit: "방문 완료", phone: "전화 완료" };

  // 진행 상태로 거르기: '방문 완료'는 전화까지 끝난 곳도 포함하고, '전화 남음'은 방문만 한 곳입니다.
  const PROGRESS_FILTERS = ["all", "none", "visited", "pending", "phone"];
  function normalizeProgressFilter(value) {
    if (value === "visit") return "visited";
    return PROGRESS_FILTERS.includes(value) ? value : "all";
  }
  function matchesProgress(result, filter) {
    const progress = progressOf(result);
    switch (normalizeProgressFilter(filter)) {
      case "none": return progress === "none";
      case "visited": return progress !== "none";
      case "pending": return progress === "visit";
      case "phone": return progress === "phone";
      default: return true;
    }
  }

  function cleanSection(section, keys) {
    const output = {};
    keys.forEach((key) => {
      const value = section ? section[key] : undefined;
      if (Array.isArray(value)) output[key] = value.map((item) => String(item).slice(0, 80)).slice(0, 10);
      else output[key] = String(value ?? "").slice(0, key === "opinion" || key === "practiceDetail" ? 600 : 200);
    });
    return output;
  }

  function formatKoreanDate(value, withWeekday) {
    if (!value) return "";
    const [y, m, d] = String(value).split("-").map(Number);
    if (!y || !m || !d) return String(value);
    const date = new Date(y, m - 1, d);
    const weekday = "일월화수목금토"[date.getDay()];
    return withWeekday ? `${y}. ${m}. ${d}. (${weekday})` : `${y}. ${m}. ${d}.`;
  }

  function telHref(phone) {
    const digits = String(phone || "").replace(/[^0-9+]/g, "");
    return digits ? `tel:${digits}` : "";
  }

  global.Hamkke = Object.freeze({
    DIVISIONS,
    VISIT_CHECKS,
    PRIORITY_OPTIONS,
    SUPPORT_OPTIONS,
    PHOTO_OPTIONS,
    VIDEO_OPTIONS,
    PROMO_OPTIONS,
    CALL_OPTIONS,
    PRACTICE_OPTIONS,
    FOLLOW_OPTIONS,
    VISIT_KEYS,
    PHONE_KEYS,
    FIELD_SCRIPT,
    PHONE_SCRIPT,
    PROGRESS_LABELS,
    normalizeProgressFilter,
    divisionClass,
    matchesProgress,
    CAMPAIGN_LABELS,
    FRAME_STATES,
    frameOf,
    nameKey,
    indexResults,
    sortStores,
    storeIdFor,
    progressOf,
    cleanSection,
    formatKoreanDate,
    telHref
  });
})(typeof window !== "undefined" ? window : globalThis);
