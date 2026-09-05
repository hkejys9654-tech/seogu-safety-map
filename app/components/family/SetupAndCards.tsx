import {
  cards,
  FamilyRecord,
  ownerOptions,
  OwnerChoice,
  PhaseData,
  PhaseKey,
} from "../../data";
import { UpdateFamily } from "./helpers";
import { BottomActions } from "./Shared";

export function FamilyInfo({
  family,
  updateFamily,
  onNext,
  busy,
}: {
  family: FamilyRecord;
  updateFamily: UpdateFamily;
  onNext: () => void;
  busy: boolean;
}) {
  return (
    <section className="content-card">
      <span className="section-kicker">1. 가족 등록</span>
      <h2>우리 가족을 알려주세요</h2>
      <p className="lead">
        이름 대신 가족끼리 알아볼 수 있는 별명을 적어도 좋아요.
      </p>
      <div className="form-grid">
        <label className="full">
          가정 이름
          <input
            value={family.familyName}
            onChange={(e) =>
              updateFamily((d) => {
                d.familyName = e.target.value;
              })
            }
            placeholder="예: 행복한 해온이네"
          />
        </label>
        <label>
          성인 1
          <input
            value={family.adults.adult1}
            onChange={(e) =>
              updateFamily((d) => {
                d.adults.adult1 = e.target.value;
              })
            }
            placeholder="이름 또는 별명"
          />
        </label>
        <label>
          성인 2
          <input
            value={family.adults.adult2}
            onChange={(e) =>
              updateFamily((d) => {
                d.adults.adult2 = e.target.value;
              })
            }
            placeholder="이름 또는 별명"
          />
        </label>
        <fieldset className="full">
          <legend>가정 유형</legend>
          <div className="segmented">
            <button
              className={family.familyType === "children" ? "selected" : ""}
              onClick={() =>
                updateFamily((d) => {
                  d.familyType = "children";
                })
              }
            >
              자녀가 있어요
            </button>
            <button
              className={family.familyType === "childless" ? "selected" : ""}
              onClick={() =>
                updateFamily((d) => {
                  d.familyType = "childless";
                  d.children = [];
                })
              }
            >
              자녀가 없어요
            </button>
          </div>
        </fieldset>
        {family.familyType === "children" && (
          <label className="full">
            자녀 이름·별명 (선택)
            <input
              value={family.children.join(", ")}
              onChange={(e) =>
                updateFamily((d) => {
                  d.children = e.target.value
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean);
                })
              }
              placeholder="여러 명이면 쉼표로 구분"
            />
          </label>
        )}
      </div>
      <BottomActions primary="함께카드 시작" onPrimary={onNext} busy={busy} />
    </section>
  );
}

export function CardSurvey({
  family,
  phase,
  data,
  cardIndex,
  setCardIndex,
  updateFamily,
  persist,
  onBack,
  onDone,
  busy,
  setNotice,
}: {
  family: FamilyRecord;
  phase: PhaseKey;
  data: PhaseData;
  cardIndex: number;
  setCardIndex: (n: number) => void;
  updateFamily: UpdateFamily;
  persist: (f: FamilyRecord) => Promise<void>;
  onBack: () => void;
  onDone: () => void;
  busy: boolean;
  setNotice: (s: string) => void;
}) {
  const card = cards[cardIndex];
  const selected = data.cards[card.id];
  const optionLabel = (value: OwnerChoice) =>
    value === "adult1"
      ? family.adults.adult1
      : value === "adult2"
        ? family.adults.adult2
        : ownerOptions.find((o) => o.value === value)?.label || "";
  async function choose(value: OwnerChoice) {
    const next = updateFamily((d) => {
      d[phase].cards[card.id] = value;
    });
    if (next) {
      try {
        await persist(next);
      } catch {
        setNotice("저장하지 못했습니다. 인터넷 연결을 확인해주세요.");
      }
    }
  }
  function move(delta: number) {
    if (!selected && delta > 0) {
      setNotice("담당 가족을 먼저 선택해주세요.");
      return;
    }
    setNotice("");
    setCardIndex(cardIndex + delta);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const answered = Object.keys(data.cards).length;
  return (
    <section className="content-card card-survey">
      <div className="card-topline">
        <span className="section-kicker">2. 함께카드</span>
        <b>{answered}/100 응답</b>
      </div>
      <div className="card-meter">
        <i style={{ width: `${answered}%` }} />
      </div>
      <div className="survey-card">
        <span className="category-pill">{card.category}</span>
        <small>카드 {card.id} / 100</small>
        <h2>
          {Number(card.id) > 98
            ? data.customTitles[card.id] || card.title
            : card.title}
        </h2>
        {Number(card.id) > 98 && (
          <input
            className="custom-role"
            value={data.customTitles[card.id] || ""}
            onChange={(e) =>
              updateFamily((d) => {
                d[phase].customTitles[card.id] = e.target.value;
              })
            }
            placeholder="우리 집만의 역할을 적어주세요"
          />
        )}
        <p>이 역할을 주로 담당하는 가족은 누구인가요?</p>
      </div>
      <div className="owner-grid">
        {ownerOptions.map((option) => (
          <button
            key={option.value}
            disabled={
              option.value === "child" && family.familyType === "childless"
            }
            className={
              selected === option.value
                ? "owner-option selected"
                : "owner-option"
            }
            onClick={() => choose(option.value)}
          >
            <span>{option.icon}</span>
            <b>{optionLabel(option.value)}</b>
          </button>
        ))}
      </div>
      <p className="tap-guide">
        선택 즉시 저장돼요. 별도의 확인 버튼은 없습니다.
      </p>
      <div className="sticky-card-actions">
        <button
          className="secondary-button"
          onClick={() => (cardIndex === 0 ? onBack() : move(-1))}
        >
          이전
        </button>
        {cardIndex < cards.length - 1 ? (
          <button className="primary-button" onClick={() => move(1)}>
            다음 카드
          </button>
        ) : (
          <button
            className="primary-button"
            onClick={() => {
              if (answered < 100) {
                setNotice(`아직 ${100 - answered}장이 남았어요.`);
                return;
              }
              onDone();
            }}
            disabled={busy}
          >
            함께지수로
          </button>
        )}
      </div>
    </section>
  );
}
