import { FamilyRecord } from "../../data";

export type UpdateFamily = (
  mutator: (draft: FamilyRecord) => void,
) => FamilyRecord | null;

export function formatError(error: unknown) {
  const firebaseError = error as { code?: string; message?: string };
  const code = firebaseError?.code || "";
  const message = firebaseError?.message || String(error);
  const details = `${code} ${message}`.toLowerCase();

  if (details.includes("not-found"))
    return "가정 번호를 확인해주세요.";
  if (
    details.includes("permission-denied") ||
    details.includes("missing or insufficient permissions")
  )
    return "가족자료를 불러오지 못했습니다. 관리자에게 문의해주세요.";
  if (details.includes("operation-not-allowed"))
    return "로그인 설정을 확인해주세요.";
  if (details.includes("network"))
    return "인터넷 연결을 확인한 뒤 다시 시도해주세요.";
  return "잠시 후 다시 시도해주세요.";
}

export function cloneFamily(value: FamilyRecord): FamilyRecord {
  return JSON.parse(JSON.stringify(value));
}
