import rawCards from "./cards.json";

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

export const indexQuestions = [
  "우리는 집안일을 누가 더 많이 하는지 서로 알고 있다.",
  "우리는 집안일을 상황에 따라 자연스럽게 나누어 한다.",
  "우리는 자녀 돌봄과 교육을 함께 책임진다.",
  "우리는 가족의 일정과 필요한 일을 함께 챙긴다.",
  "우리는 아프거나 힘든 가족을 함께 돌본다.",
  "우리는 집안일의 방법과 기준을 서로 존중한다.",
  "우리는 가족을 위한 일도 중요한 노동이라고 생각한다.",
  "우리는 집안일 때문에 한 사람만 쉬지 못하는 일이 적다.",
  "우리는 역할 분담에 불편함이 생기면 대화로 조정한다.",
  "우리는 서로의 수고를 알아보고 고마움을 표현한다.",
];

export const childlessQuestion = "우리는 서로의 일을 대신할 수 있다.";

export const satisfactionQuestions = [
  "함께카드를 통해 우리 가족의 역할을 쉽게 살펴볼 수 있었다.",
  "함께노트와 30일 실천이 역할을 조정하는 데 도움이 되었다.",
  "가족과 집안일·돌봄에 대해 대화하는 시간이 늘었다.",
  "앞으로도 가족이 함께 역할을 나누어 실천할 수 있을 것 같다.",
  "함께가정 활동을 다른 가족에게 추천하고 싶다.",
];

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
