import { useMemo, useState } from "react";
import {
  cardsFor,
  categoriesFor,
  FamilyRecord,
  hasSecondAdult,
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
  const [single, setSingle] = useState(
    () => Boolean(family.adults.adult1.trim()) && !family.adults.adult2.trim(),
  );
  return (
    <section className="content-card">
      <span className="section-kicker">1. 가족 등록</span>
      <h2>우리 가족을 알려주세요</h2>
      <p className="lead">성인 구성원의 실명을 입력해주세요.</p>
      <div className="form-grid">
        <label className={single ? "full" : ""}>
          성인 1
          <input
            value={family.adults.adult1}
            onChange={(e) =>
              updateFamily((d) => {
                d.adults.adult1 = e.target.value;
              })
            }
            placeholder="실명 입력"
          />
        </label>
        {!single && (
          <label>
            성인 2
            <input
              value={family.adults.adult2}
              onChange={(e) =>
                updateFamily((d) => {
                  d.adults.adult2 = e.target.value;
                })
              }
              placeholder="실명 입력"
            />
          </label>
        )}
        <label className="full checkbox-line">
          <input
            type="checkbox"
            checked={single}
            onChange={(e) => {
              const next = e.target.checked;
              setSingle(next);
              if (next)
                updateFamily((d) => {
                  d.adults.adult2 = "";
                });
            }}
          />
          <span>어른이 한 분인 가정입니다</span>
        </label>
        <fieldset className="full">
          <legend>가정 유형</legend>
          <div className="segmented">
            <button
              className={family.familyType === "children" ? "selected" : ""}
              onClick={() =>
                updateFamily((d) => {
                  d.familyType = "children";
                  d.children = [];
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
          {family.familyType === "childless" && (
            <p className="field-help">
              자녀가 없는 가정은 아이돌봄·아이교육 38장을 빼고 62장으로
              진행합니다.
            </p>
          )}
        </fieldset>
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
  const visible = useMemo(
    () => cardsFor(family.familyType),
    [family.familyType],
  );
  const categories = useMemo(
    () => categoriesFor(family.familyType),
    [family.familyType],
  );
  const total = visible.length;
  const groupIndex = Math.min(cardIndex, categories.length - 1);
  const category = categories[groupIndex];
  const groupCards = visible.filter((card) => card.category === category);

  const options = ownerOptions.filter(
    (option) =>
      !(option.value === "child" && family.familyType === "childless") &&
      !(option.value === "adult2" && !hasSecondAdult(family)),
  );
  const optionLabel = (value: OwnerChoice) =>
    value === "adult1"
      ? family.adults.adult1 || "성인 1"
      : value === "adult2"
        ? family.adults.adult2 || "성인 2"
        : ownerOptions.find((o) => o.value === value)?.label || "";

  const answered = visible.filter((card) => data.cards[card.id]).length;
  const groupAnswered = groupCards.filter((card) => data.cards[card.id]).length;

  async function save(mutator: (draft: FamilyRecord) => void) {
    const next = updateFamily(mutator);
    if (!next) return;
    try {
      await persist(next);
    } catch {
      setNotice("저장하지 못했습니다. 인터넷 연결을 확인해주세요.");
    }
  }

  function choose(cardId: string, value: OwnerChoice) {
    setNotice("");
    void save((d) => {
      d[phase].cards[cardId] = value;
    });
  }

  function fillRestWithNa() {
    setNotice("");
    void save((d) => {
      groupCards.forEach((card) => {
        if (!d[phase].cards[card.id]) d[phase].cards[card.id] = "na";
      });
    });
  }

  function move(delta: number) {
    if (delta > 0 && groupAnswered < groupCards.length) {
      setNotice(
        `${category} 영역에 ${groupCards.length - groupAnswered}장이 남았어요.`,
      );
      return;
    }
    setNotice("");
    setCardIndex(groupIndex + delta);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <section className="content-card card-survey">
      <div className="card-topline">
        <span className="section-kicker">2. 함께카드</span>
        <b>
          {answered}/{total} 응답
        </b>
      </div>
      <div className="card-meter">
        <i style={{ width: `${(answered / total) * 100}%` }} />
      </div>

      <div className="category-tabs" role="tablist">
        {categories.map((name, i) => {
          const done = visible
            .filter((card) => card.category === name)
            .every((card) => data.cards[card.id]);
          return (
            <button
              key={name}
              role="tab"
              aria-selected={i === groupIndex}
              className={
                i === groupIndex
                  ? "category-tab selected"
                  : done
                    ? "category-tab done"
                    : "category-tab"
              }
              onClick={() => {
                setNotice("");
                setCardIndex(i);
              }}
            >
              {name}
              {done && <i aria-hidden>✓</i>}
            </button>
          );
        })}
      </div>

      <div className="group-head">
        <h2>{category}</h2>
        <span>
          {groupAnswered}/{groupCards.length}
        </span>
      </div>
      <p className="lead">이 역할을 주로 담당하는 가족을 골라주세요.</p>

      <div className="owner-legend">
        {options.map((option) => (
          <span key={option.value}>
            <b>{option.icon}</b>
            {optionLabel(option.value)}
          </span>
        ))}
      </div>

      <ul className="card-list">
        {groupCards.map((card) => {
          const selected = data.cards[card.id];
          const custom = Number(card.id) > 98;
          return (
            <li
              key={card.id}
              className={selected ? "card-row answered" : "card-row"}
            >
              <div className="card-row-title">
                <small>{card.id}</small>
                <div>
                  <strong>
                    {custom
                      ? data.customTitles[card.id] || card.title
                      : card.title}
                  </strong>
                  {card.desc && <em>{card.desc}</em>}
                  {custom && (
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
                </div>
              </div>
              <div className="owner-inline">
                {options.map((option) => (
                  <button
                    key={option.value}
                    title={optionLabel(option.value)}
                    aria-label={optionLabel(option.value)}
                    className={
                      selected === option.value
                        ? "owner-chip selected"
                        : "owner-chip"
                    }
                    onClick={() => choose(card.id, option.value)}
                  >
                    {option.icon}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      {groupAnswered < groupCards.length && (
        <button className="bulk-button" onClick={fillRestWithNa}>
          남은 {groupCards.length - groupAnswered}장을 모두 “해당 없음”으로
        </button>
      )}
      <p className="tap-guide">선택 즉시 저장돼요. 확인 버튼은 없습니다.</p>

      <div className="sticky-card-actions">
        <button
          className="secondary-button"
          onClick={() => (groupIndex === 0 ? onBack() : move(-1))}
        >
          이전
        </button>
        {groupIndex < categories.length - 1 ? (
          <button className="primary-button" onClick={() => move(1)}>
            다음 영역
          </button>
        ) : (
          <button
            className="primary-button"
            onClick={() => {
              if (answered < total) {
                setNotice(`아직 ${total - answered}장이 남았어요.`);
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
