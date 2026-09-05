import rawCards from "./cards.json";
export {
  changeWishQuestion,
  childlessQuestion,
  indexQuestions,
  satisfactionQuestions,
} from "./content";

export type OwnerChoice =
  | "adult1"
  | "adult2"
  | "child"
  | "together"
  | "none"
  | "na";
export type IndexChoice = "O" | "△" | "X";
export type PhaseKey = "pre" | "post";

export type Card = { id: string; category: string; title: string };
export const cards = rawCards as Card[];

export const ownerOptions: {
  value: OwnerChoice;
  label: string;
  icon: string;
}[] = [
  { value: "adult1", label: "성인 1", icon: "①" },
  { value: "adult2", label: "성인 2", icon: "②" },
  { value: "child", label: "자녀", icon: "♧" },
  { value: "together", label: "가족 같이", icon: "♡" },
  { value: "none", label: "담당 없음", icon: "―" },
  { value: "na", label: "해당 없음", icon: "×" },
];

export function indexScore(answers: (IndexChoice | null)[]) {
  return answers.reduce(
    (sum, answer) => sum + (answer === "O" ? 10 : answer === "△" ? 5 : 0),
    0,
  );
}

export function indexType(score: number) {
  if (score >= 85) return "이미 함께하는 가정";
  if (score >= 60) return "함께 가는 중인 가정";
  if (score >= 35) return "한쪽으로 기울어진 가정";
  return "이제 시작하는 가정";
}

export function blankPhase() {
  return {
    cards: {} as Record<string, OwnerChoice>,
    customTitles: {} as Record<string, string>,
    indexAnswers: {
      adult1: Array<IndexChoice | null>(10).fill(null),
      adult2: Array<IndexChoice | null>(10).fill(null),
    },
    times: {
      adult1: { housework: "", mental: "", rest: "" },
      adult2: { housework: "", mental: "", rest: "" },
    },
    satisfaction: { ratings: Array<number | null>(5).fill(null), feedback: "" },
    status: "draft" as "draft" | "submitted",
  };
}

export type PhaseData = ReturnType<typeof blankPhase>;

export type FamilyRecord = {
  _docId?: string;
  familyNo: number;
  accessPin: string;
  ownerUid: string;
  familyName: string;
  familyType: "children" | "childless";
  adults: { adult1: string; adult2: string };
  children: string[];
  changeWish: string;
  pre: PhaseData;
  post: PhaseData;
  completionCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export async function familyDocumentId(familyNo: number, accessPin: string) {
  const value = new TextEncoder().encode(
    `hamkke-family-v1:${familyNo}:${accessPin}`,
  );
  const digest = await crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function blankFamily(familyNo: number, accessPin: string): FamilyRecord {
  return {
    familyNo,
    accessPin,
    ownerUid: "",
    familyName: "",
    familyType: "children",
    adults: { adult1: "", adult2: "" },
    children: [],
    changeWish: "",
    pre: blankPhase(),
    post: blankPhase(),
    completionCount: 0,
  };
}
