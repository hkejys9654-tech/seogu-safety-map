import { FamilyRecord, ownerOptions } from "../../data";

export function ts(value: unknown) {
  if (!value) return "-";
  const date =
    typeof value === "object" && value && "toDate" in value
      ? (value as { toDate: () => Date }).toDate()
      : new Date(String(value));
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleString("ko-KR", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export function randomPin(used: Set<string>) {
  let pin = "";
  do pin = String(Math.floor(100000 + Math.random() * 900000));
  while (used.has(pin));
  used.add(pin);
  return pin;
}

export function Status({ value }: { value: string }) {
  return (
    <span
      className={value === "submitted" ? "status submitted" : "status draft"}
    >
      {value === "submitted" ? "제출" : "작성중"}
    </span>
  );
}

export function ownerLabel(family: FamilyRecord, value?: string) {
  if (!value) return "미응답";
  if (value === "adult1") return family.adults.adult1 || "성인 1";
  if (value === "adult2") return family.adults.adult2 || "성인 2";
  return ownerOptions.find((o) => o.value === value)?.label || value;
}
