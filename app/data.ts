export type ChoreCard = {
  id: string;
  name: string;
  notice: string;
  prepare: string;
  action: string;
  kid: boolean;
  invisible: boolean;
  position: number;
};

export type Member = { id: string; nickname: string; kid: boolean };
export type WeekRecord = {
  picks: Record<string, { cardId: string; promise: string }>;
  checks: Record<string, boolean[]>;
  thanks: { memberId: string; note: string };
};

export type FamilyRecord = {
  no: string;
  members: Member[];
  placementBefore: Record<string, string>;
  placementAfter: Record<string, string>;
  weeks: WeekRecord[];
  updatedAt?: string;
};

export const WEEK_INFO = [
  { label: "1주차", period: "함께 시작하기" },
  { label: "2주차", period: "작은 약속 이어가기" },
  { label: "3주차", period: "서로 응원하기" },
  { label: "4주차", period: "우리집 변화 돌아보기" },
];

const CARD_ROWS: Array<Omit<ChoreCard, "id" | "position">> = [
  { name: "아침 차리기", notice: "무엇을 먹을지 살피기", prepare: "재료 확인하기", action: "차리고 치우기", kid: false, invisible: false },
  { name: "저녁 차리기", notice: "메뉴 정하기", prepare: "장보기·손질하기", action: "요리하고 차리기", kid: false, invisible: false },
  { name: "설거지", notice: "그릇과 조리도구 살피기", prepare: "세제·수세미 준비하기", action: "씻고 정리하기", kid: false, invisible: false },
  { name: "청소", notice: "더러워진 곳 알아채기", prepare: "도구·세제 준비하기", action: "청소하고 정돈하기", kid: false, invisible: false },
  { name: "빨래 돌리기·널기", notice: "빨랫감 살피기", prepare: "세제와 분류 준비하기", action: "돌리고 널기", kid: false, invisible: false },
  { name: "빨래 개기·정리", notice: "마른 빨래 확인하기", prepare: "갤 자리 만들기", action: "개어 제자리에 넣기", kid: true, invisible: false },
  { name: "장보기", notice: "필요한 것 알아채기", prepare: "목록 작성하기", action: "사 오고 정리하기", kid: false, invisible: false },
  { name: "쓰레기·분리수거", notice: "배출일 기억하기", prepare: "분류·봉투 준비하기", action: "분리해 내놓기", kid: true, invisible: false },
  { name: "아이 등원·등교", notice: "출발 시간 살피기", prepare: "깨우고 챙기기", action: "안전하게 데려다주기", kid: false, invisible: false },
  { name: "아이 하원·하교", notice: "마치는 시간 확인하기", prepare: "일정 조율하기", action: "안전하게 데려오기", kid: false, invisible: false },
  { name: "아이 목욕·씻기기", notice: "씻을 때 알아채기", prepare: "옷·수건 준비하기", action: "씻기고 정리하기", kid: false, invisible: false },
  { name: "아이 재우기", notice: "잘 시간 챙기기", prepare: "잠자리 준비하기", action: "편안히 재우기", kid: false, invisible: false },
  { name: "아이와 놀아주기", notice: "하고 싶은 것 물어보기", prepare: "시간·놀잇감 준비하기", action: "함께 놀기", kid: true, invisible: false },
  { name: "아이 숙제 봐주기", notice: "숙제 있는지 확인하기", prepare: "자리·도구 준비하기", action: "함께 살펴보기", kid: true, invisible: false },
  { name: "집 정리·수납", notice: "어질러진 곳 알아채기", prepare: "둘 자리 만들기", action: "정리하기", kid: true, invisible: false },
  { name: "아이 준비물 챙기기", notice: "내일 필요한 것 확인하기", prepare: "미리 마련하기", action: "가방에 넣기", kid: true, invisible: true },
  { name: "학원·학교 일정 관리", notice: "일정 파악하기", prepare: "달력에 표시하기", action: "시간 맞춰 챙기기", kid: false, invisible: true },
  { name: "병원 예약·예방접종", notice: "접종·검진 시기 알기", prepare: "예약하기", action: "함께 다녀오기", kid: false, invisible: true },
  { name: "아이 옷·신발 사이즈", notice: "작아진 것 알아채기", prepare: "필요한 것 정하기", action: "구입해 정리하기", kid: false, invisible: true },
  { name: "냉장고 재고 파악", notice: "떨어진 식재료 살피기", prepare: "살 목록에 넣기", action: "채워 넣기", kid: true, invisible: true },
  { name: "생필품 챙기기", notice: "남은 양 확인하기", prepare: "주문·구입하기", action: "채워두기", kid: false, invisible: true },
  { name: "가족 경조사·선물", notice: "날짜 기억하기", prepare: "마음과 선물 준비하기", action: "연락하고 전달하기", kid: false, invisible: true },
  { name: "공과금·각종 신청", notice: "납부일·기한 파악하기", prepare: "서류 준비하기", action: "처리하기", kid: false, invisible: true },
  { name: "양가 부모님 챙기기", notice: "안부·건강 살피기", prepare: "연락 시간 내기", action: "연락·방문하기", kid: false, invisible: true },
  { name: "아이 친구·학교생활", notice: "관계와 생활 살피기", prepare: "들을 시간 만들기", action: "이야기 나누기", kid: false, invisible: true },
  { name: "가족 일정 관리", notice: "이번 주 일정 파악하기", prepare: "달력에 정리하기", action: "서로에게 알리기", kid: false, invisible: true },
  { name: "아이 감정·컨디션", notice: "기분 알아채기", prepare: "대화 시간 내기", action: "마음을 살펴주기", kid: false, invisible: true },
  { name: "계절 옷·이불 교체", notice: "계절 변화 알아채기", prepare: "정리·세탁 준비하기", action: "바꿔 넣기", kid: false, invisible: true },
  { name: "집 수리·관리", notice: "고장난 곳 알아채기", prepare: "방법·업체 알아보기", action: "수리하고 확인하기", kid: false, invisible: true },
  { name: "우리 가족 쉼 챙기기", notice: "누가 지쳤는지 살피기", prepare: "쉴 시간 만들기", action: "서로 쉬게 해주기", kid: false, invisible: true },
];

export const DEFAULT_CARDS: ChoreCard[] = CARD_ROWS.map((card, index) => ({
  ...card,
  id: `c${index + 1}`,
  position: index,
}));

export function createBlankFamily(no: string): FamilyRecord {
  return {
    no,
    members: [
      { id: "m1", nickname: "", kid: false },
      { id: "m2", nickname: "", kid: false },
      { id: "m3", nickname: "", kid: true },
    ],
    placementBefore: {},
    placementAfter: {},
    weeks: WEEK_INFO.map(() => ({
      picks: {},
      checks: {},
      thanks: { memberId: "", note: "" },
    })),
  };
}
