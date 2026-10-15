(function (global) {
  "use strict";

  // 붙임2 한글(HWPX) 서식 틀(result-template.hwpx)의 {{키}} 자리에 입력값을 채워 넣습니다.
  // 서식(표·글꼴·칸 크기)은 틀 파일 그대로 두고 글자만 바꿉니다.
  const HP_NS = "http://www.hancom.co.kr/hwpml/2011/paragraph";
  const H = global.Hamkke;
  const STORE_FIRST = ["mimetype", "version.xml"];

  const DEFAULTS = {
    visitDateTime: "2026.   .   . (  )   :",
    participants: "조장(분과장):                     팀원:                    ,",
    consentName: "성명:                         (서명)                         ",
    practiceDetail: "구체적 실천 사례·애로사항:                                             ",
    writer: "                         (서명)"
  };

  function mark(on) {
    return on ? "■" : "□";
  }

  function options(list, selected, sep) {
    const chosen = Array.isArray(selected) ? selected : [selected];
    return list.map((item) => `${mark(chosen.includes(item))} ${item}`).join(sep === undefined ? "   " : sep);
  }

  function oneLine(value) {
    return String(value ?? "").replace(/\s*\r?\n\s*/g, " ").trim();
  }

  function shortDate(value) {
    if (!value) return "";
    const [, m, d] = String(value).split("-").map(Number);
    return m && d ? `${m}. ${d}.` : String(value);
  }

  function tokensFor(store, result) {
    const visit = (result && result.visit) || {};
    const phone = (result && result.phone) || {};
    const P = H.PRIORITY_OPTIONS;
    const S = H.SUPPORT_OPTIONS;
    const tokens = {
      division: store.division || "",
      storeName: store.name || "",
      category: visit.category || store.category || "",
      address: store.address || "",
      opinion: oneLine(visit.opinion),
      comment: oneLine(visit.comment)
    };

    tokens.visitDateTime = visit.date
      ? `${H.formatKoreanDate(visit.date, true)}${visit.time ? ` ${visit.time}` : ""}`
      : DEFAULTS.visitDateTime;

    tokens.participants = visit.leader || visit.members
      ? `조장(분과장): ${visit.leader || "          "}     팀원: ${visit.members || ""}`
      : DEFAULTS.participants;

    H.VISIT_CHECKS.forEach((check) => { tokens[check.key] = options(check.options, visit[check.key]); });

    const priority = visit.priority || "";
    tokens.priorityLine1 = `  ${mark(priority === P[0])} ${P[0]} ${mark(priority === P[1])} ${P[1]} `;
    tokens.priorityLine2 = `  ${mark(priority === P[2])} ${P[2]}   ${mark(priority === P[3])} ${P[3]}`;
    tokens.priorityLine3 = `  ${mark(priority === "기타")} 기타: ${priority === "기타" ? oneLine(visit.priorityOther) : " "}`;

    const support = Array.isArray(visit.support) ? visit.support : [];
    tokens.supportLine1 = options(S.slice(0, 3), support);
    tokens.supportLine2 = `${options(S.slice(3, 5), support)}   ${mark(support.includes("기타"))} 기타: ${support.includes("기타") && visit.supportOther ? oneLine(visit.supportOther) : "                        "}`;

    tokens.photo = options(H.PHOTO_OPTIONS, visit.photo);
    tokens.video = options(H.VIDEO_OPTIONS, visit.video);
    tokens.promo = options(H.PROMO_OPTIONS, visit.promo || []);
    tokens.consentName = visit.consentName ? `성명: ${oneLine(visit.consentName)}          (서명)` : DEFAULTS.consentName;

    const checkDate = phone.date ? H.formatKoreanDate(phone.date) : "2026.   .   .";
    tokens.phoneCheck = `확인일: ${checkDate}   확인자: ${phone.checker || "               "}   ${options(H.CALL_OPTIONS, phone.callResult)}`;
    tokens.practice = options(H.PRACTICE_OPTIONS, phone.practice);
    tokens.practiceDetail = phone.practiceDetail ? `구체적 실천 사례·애로사항: ${oneLine(phone.practiceDetail)}` : DEFAULTS.practiceDetail;
    const follow = phone.followUp || "";
    tokens.followUp = `${mark(follow === "없음")} 없음   ${mark(follow === "재통화")} 재통화(${follow === "재통화" && phone.recallDate ? shortDate(phone.recallDate) : "   .   ."})   ${mark(follow === "담당부서 연계")} 담당부서 연계`;
    tokens.writer = phone.writer ? `${oneLine(phone.writer)}          (서명)` : DEFAULTS.writer;
    return tokens;
  }

  function elementChildren(node) {
    const list = [];
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 1) list.push(child);
    }
    return list;
  }

  function fillSectionXml(xmlText, records) {
    const doc = new global.DOMParser().parseFromString(xmlText, "application/xml");
    const root = doc.documentElement;
    const template = elementChildren(root);
    template.forEach((node) => root.removeChild(node));
    let idSeed = 1000000000 + Math.floor(Math.random() * 900000000);

    records.forEach((record, index) => {
      const tokens = tokensFor(record.store, record.result);
      template.forEach((original, paraIndex) => {
        const clone = original.cloneNode(true);
        if (index > 0) {
          if (paraIndex === 0) {
            // 두 번째 점포부터는 구역 설정을 빼고 새 쪽에서 시작합니다.
            const runs = elementChildren(clone).filter((node) => node.localName === "run");
            const sectionRun = runs.find((run) => run.getElementsByTagNameNS(HP_NS, "secPr").length);
            if (sectionRun) clone.removeChild(sectionRun);
            clone.setAttribute("pageBreak", "1");
          }
          [clone, ...Array.from(clone.getElementsByTagNameNS(HP_NS, "*"))].forEach((node) => {
            if ((node.localName === "p" || node.localName === "tbl") && /^\d+$/.test(node.getAttribute("id") || "")) {
              idSeed += 7;
              node.setAttribute("id", String(idSeed));
            }
          });
        }
        Array.from(clone.getElementsByTagNameNS(HP_NS, "t")).forEach((t) => {
          const match = /^\{\{(\w+)\}\}$/.exec(t.textContent || "");
          if (match) t.textContent = tokens[match[1]] ?? "";
        });
        root.appendChild(clone);
      });
    });

    const body = new global.XMLSerializer().serializeToString(root);
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>${body}`;
  }

  async function build(templateData, records, JSZipLib) {
    const Zip = JSZipLib || global.JSZip;
    const source = await Zip.loadAsync(templateData);
    const names = Object.keys(source.files).filter((name) => !source.files[name].dir);
    const ordered = [...STORE_FIRST.filter((name) => names.includes(name)), ...names.filter((name) => !STORE_FIRST.includes(name))];
    const output = new Zip();
    for (const name of ordered) {
      let data = await source.file(name).async("uint8array");
      if (name === "Contents/section0.xml") {
        const xml = new TextDecoder("utf-8").decode(data);
        data = new TextEncoder().encode(fillSectionXml(xml, records));
      }
      output.file(name, data, {
        compression: STORE_FIRST.includes(name) ? "STORE" : "DEFLATE",
        createFolders: false,
        date: new Date(Date.UTC(1980, 0, 1))
      });
    }
    return output;
  }

  let templateCache = null;
  async function loadTemplate(url) {
    if (!templateCache) {
      templateCache = fetch(url, { cache: "no-cache" }).then((response) => {
        if (!response.ok) throw new Error("한글 서식 틀을 불러오지 못했습니다.");
        return response.arrayBuffer();
      }).catch((error) => {
        templateCache = null;
        throw error;
      });
    }
    return templateCache;
  }

  function safeFileName(name) {
    return String(name || "점포").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim().slice(0, 60);
  }

  global.HamkkeHwpx = { tokensFor, fillSectionXml, build, loadTemplate, safeFileName };
})(typeof window !== "undefined" ? window : globalThis);
