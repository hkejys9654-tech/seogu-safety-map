import { FamilyRecord } from "../../data";

export type UpdateFamily = (
  mutator: (draft: FamilyRecord) => void,
) => FamilyRecord | null;

export function formatError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("permission-denied") || message.includes("not-found"))
    return "가정 번호를 확인해주세요.";
  if (message.includes("operation-not-allowed"))
    return "로그인 설정을 확인해주세요.";
  if (message.includes("network"))
    return "인터넷 연결을 확인한 뒤 다시 시도해주세요.";
  return "잠시 후 다시 시도해주세요.";
}

export function cloneFamily(value: FamilyRecord): FamilyRecord {
  return JSON.parse(JSON.stringify(value));
}
