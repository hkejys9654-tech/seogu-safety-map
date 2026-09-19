import {
  cardsFor,
  childlessQuestion,
  FamilyRecord,
  hasAdditionalResponse,
  hasSecondAdult,
  hasTwoPersonReport,
  indexQuestions,
  PhaseKey,
} from "../../data";
import { ownerLabel } from "./helpers";

export async function exportExcel(families: FamilyRecord[]) {
  const XLSX = await import("xlsx");
  const summary = families.map((f) => ({
    가정번호: f.familyNo,
    신청자이름: f.applicantName || "",
    성인1: f.adults.adult1,
    성인2: f.adults.adult2 || "(어른 1인 가정)",
    바꾸고싶은점: f.changeWish || "",
    사전상태: f.pre.status === "submitted" ? "제출완료" : "작성중",
    사후상태: f.post.status === "submitted" ? "제출완료" : "작성중",
    추가응답:
      !hasSecondAdult(f)
        ? "성인 1인 가정"
        : hasTwoPersonReport(f)
          ? "사전·사후 참여"
          : hasAdditionalResponse(f, "pre") || hasAdditionalResponse(f, "post")
            ? "일부 참여"
            : "선택 미참여",
    리포트유형: hasTwoPersonReport(f) ? "2인 응답" : "1인 응답",
    가족사진: f.familyPhoto ? "등록" : "미등록",
    홍보활용동의: f.familyPhoto?.publicityConsent ? "동의" : "미동의",
    활동인증횟수: f.completionCount,
  }));
  const detail: Record<string, string | number>[] = [];
  families.forEach((f) =>
    (["pre", "post"] as PhaseKey[]).forEach((p) =>
      cardsFor(f.familyType).forEach((c) =>
        detail.push({
          가정번호: f.familyNo,
          조사: p === "pre" ? "사전" : "사후",
          카드번호: Number(c.id),
          영역: c.category,
          역할: f[p].customTitles?.[c.id] || c.title,
          담당: ownerLabel(f, f[p].cards[c.id]),
        }),
      ),
    ),
  );
  const indexRows: Record<string, string | number>[] = [];
  families.forEach((f) =>
    (["pre", "post"] as PhaseKey[]).forEach((p) =>
      ([
        "adult1",
        ...(hasAdditionalResponse(f, p) ? (["adult2"] as const) : []),
      ] as const).forEach((who) =>
        indexQuestions.forEach((q, i) =>
          indexRows.push({
            가정번호: f.familyNo,
            조사: p === "pre" ? "사전" : "사후",
            응답자:
              who === "adult1"
                ? f.applicantName || f.adults.adult1
                : f[p].indexRespondents?.adult2 || f.adults.adult2,
            응답유형: who === "adult1" ? "대표 응답" : "추가 응답",
            문항번호: i + 1,
            문항:
              i === 2 && f.familyType === "childless" ? childlessQuestion : q,
            응답: f[p].indexAnswers[who][i] || "",
          }),
        ),
      ),
    ),
  );
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet(summary),
    "가정현황",
  );
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet(detail),
    "함께카드 전체",
  );
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet(indexRows),
    "함께지수 전체",
  );
  XLSX.writeFile(
    book,
    `함께가정_전체자료_${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}
