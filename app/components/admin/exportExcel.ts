import {
  cards,
  childlessQuestion,
  FamilyRecord,
  indexQuestions,
  PhaseKey,
} from "../../data";
import { ownerLabel } from "./helpers";

export async function exportExcel(families: FamilyRecord[]) {
  const XLSX = await import("xlsx");
  const summary = families.map((f) => ({
    가정번호: f.familyNo,
    신청자이름: f.applicantName || "",
    가정이름: f.familyName,
    성인1: f.adults.adult1,
    성인2: f.adults.adult2,
    바꾸고싶은점: f.changeWish || "",
    사전상태: f.pre.status === "submitted" ? "제출완료" : "작성중",
    사후상태: f.post.status === "submitted" ? "제출완료" : "작성중",
    활동인증횟수: f.completionCount,
  }));
  const detail: Record<string, string | number>[] = [];
  families.forEach((f) =>
    (["pre", "post"] as PhaseKey[]).forEach((p) =>
      cards.forEach((c) =>
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
      (["adult1", "adult2"] as const).forEach((who) =>
        indexQuestions.forEach((q, i) =>
          indexRows.push({
            가정번호: f.familyNo,
            조사: p === "pre" ? "사전" : "사후",
            응답자: f.adults[who],
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
