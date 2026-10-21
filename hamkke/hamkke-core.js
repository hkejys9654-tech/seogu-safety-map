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
      title: "사업 안내 및 소통",
      lines: [
        "“안녕하십니까? 저희는 서구 여성친화도시 시민참여단입니다. 사장님, 지금 잠시 10분 정도 시간 괜찮으실까요?",
        "지난 8월 ‘함께가게’ 실천약속에 참여해 주셔서 감사드리고, 실천약속 액자를 직접 전달해 드리기 위해 방문했습니다.",
        "‘함께가게’는 손님과 종사자 모두를 존중하고, 차별과 편견 없는 가게문화를 함께 만들어가는 사업입니다. 액자에 담긴 실천사항을 사장님과 한번 확인하고 참여 서명을 부탁드리겠습니다.”",
        "(서명 후) “실천사항 가운데 우리 가게에서 가장 먼저 실천하고 싶은 약속 한 가지를 선택해 주시겠습니까?”",
        "(선택 후 확인) “사장님께서 선택하신 우선 실천약속은 ‘○○○○’입니다. 오늘부터 우리 가게의 우선 실천약속으로 함께 실천해 주시면 감사하겠습니다. 선택하신 내용은 함께가게 활동결과에 기록하겠습니다.”",
        "“서구청에서는 올해 참여가게의 의견을 바탕으로 2027년 홍보·디자인 등 가게 운영에 도움이 되는 상생프로젝트를 검토하고 있습니다. 사장님께서 필요하다고 생각하시는 지원이나 의견이 있으시면 편하게 말씀해 주세요.”",
        "“선택하신 약속이 잘 이어지고 있는지 확인하기 위해 방문 후 1~2개월 이내에 시민참여단이 3분 정도 전화드릴 예정입니다. 통화가 어려운 시간대가 있으시면 말씀해 주세요.”"
      ]
    },
    {
      role: "팀원 1",
      title: "액자 전달 및 설치",
      lines: [
        "“참여해 주신 덕분에 우리 동네에 존중과 배려의 문화가 조금씩 확산되고 있습니다. 이 액자는 손님들이 잘 볼 수 있는 곳에 놓아주시면 좋겠습니다. 어느 곳에 두거나 부착해 드리면 좋을까요?”",
        "※ 점주가 원할 경우에만 부착하고, 부착이 어려운 점포에는 거치 또는 전달"
      ]
    },
    {
      role: "팀원 2",
      title: "의견 청취 및 촬영",
      lines: [
        "“함께가게 운영과 관련해 한 가지만 여쭤보겠습니다. 앞으로 가게 홍보나 운영에 어떤 지원이 있으면 가장 도움이 되실까요?”",
        "(의견을 들은 후) “참여기념 사진을 촬영해도 괜찮으실까요? 동의해 주시면 서구청 홍보자료에 ‘우리 동네 함께가게’로 소개될 수 있습니다.”",
        "(촬영 동의 시) “‘생활 속 평등, 함께가게!’ 구호와 함께 손하트 부탁드리겠습니다.”",
        "(영상 촬영은 별도로 다시 확인) “영상 촬영도 괜찮으시면 참여 소감이나 함께가게에 바라는 점을 한 말씀 부탁드리겠습니다.”",
        "“조금 전에 선택하신 우선 실천약속을 앞으로 가게에서 어떻게 실천하고 싶으신지 한 말씀 부탁드리겠습니다.”",
        "※ 예시 답변: “손님과 직원 모두에게 차별적인 표현을 사용하지 않겠습니다.” / “누구나 존중받고 편안하게 이용할 수 있는 가게를 만들겠습니다.”"
      ]
    },
    {
      role: "다같이",
      title: "마무리",
      lines: [
        "“바쁘신 중에도 참여해 주셔서 감사합니다. 사장님의 실천이 우리 동네의 존중과 배려 문화를 만드는 데 큰 힘이 됩니다. 앞으로도 함께해 주세요. 사업 번창하시길 바랍니다.”"
      ]
    },
    {
      role: "상황별",
      title: "대응 문구",
      lines: [
        "【지금 바쁜 경우】 “네, 장사에 방해되지 않도록 다시 방문드리겠습니다. 편하신 시간대를 알려주시면 맞춰 찾아뵙겠습니다.”",
        "【사진 촬영을 원하지 않는 경우】 “괜찮습니다. 사진 촬영은 선택사항입니다. 액자만 전달해 드리겠습니다.”",
        "【액자 부착을 원하지 않는 경우】 “네, 부착하지 않으셔도 됩니다. 보관하셨다가 편한 곳에 놓아주시면 됩니다.”",
        "【점주가 자리에 없는 경우】 “함께가게 참여 관련 액자 전달을 위해 방문했습니다. 사장님께서 계시는 시간을 확인해 다시 방문드리겠습니다.”",
        "【사업에 대해 자세히 묻는 경우】 “올해는 생활 속 평등 실천에 동참하는 가게를 발굴하고 현장 의견을 듣는 단계입니다. 수렴한 의견은 향후 가게에 실질적인 도움이 되는 사업을 마련하는 데 활용할 예정입니다.”"
      ]
    }
  ];

  const PHONE_SCRIPT = [
    {
      role: "①",
      title: "인사 및 통화 가능 여부",
      lines: [
        "“안녕하십니까? 서구 여성친화도시 시민참여단 ○○○입니다. 지난 ○월 함께가게 현장방문 이후, 사장님께서 선택하신 우선 실천약속을 어떻게 실천하고 계신지 확인드리려고 전화드렸습니다. 지금 3분 정도 통화 괜찮으실까요?”",
        "※ 통화가 어려운 경우: “네, 편하신 시간에 다시 연락드리겠습니다. 언제 통화하면 괜찮으실까요?”"
      ]
    },
    {
      role: "②",
      title: "우선 실천약속 실행 여부",
      lines: [
        "“사장님께서 선택하신 우선 실천약속은 ‘○○○○’이었습니다. 현재 이 약속을 어떻게 실천하고 계신가요?”",
        "※ 답변 확인: 실천 중 / 일부 실천·보완 필요 / 미실천 / 확인 곤란"
      ]
    },
    {
      role: "③",
      title: "구체적 사례 및 애로사항 확인",
      lines: [
        "“실천하면서 달라진 점이나 기억에 남는 구체적인 사례가 있을까요?”",
        "“실천하기 어려운 점이나 서구청의 도움이 필요한 부분이 있을까요?”"
      ]
    },
    {
      role: "④",
      title: "마무리",
      lines: [
        "“말씀해 주신 내용은 함께가게 운영과 향후 지원방안 마련에 활용하겠습니다. 계속 함께 실천해 주셔서 감사합니다. 사업 번창하시길 바랍니다.”",
        "※ 기록 유의사항: 점주 답변을 유도하지 않고 그대로 기록하며, 연락이 닿지 않으면 다른 날 1회 재통화한 후 ‘연락 안 됨’으로 기록. 지원 요청이 있으면 담당부서에 전달"
      ]
    }
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
  const FRAME_STATES = ["배부완료", "1차 행사 수령", "액자 보관 중"];
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

  const PROGRESS_LABELS = { none: "방문 전", visit: "방문 완료", phone: "전화 완료" };

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
    CAMPAIGN_LABELS,
    FRAME_STATES,
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
