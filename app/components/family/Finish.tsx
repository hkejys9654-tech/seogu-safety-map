import { useMemo } from "react";
import {
  cardsFor,
  changeWishQuestion,
  FamilyRecord,
  hasSecondAdult,
  indexScore,
  indexType,
  ownerOptions,
  PhaseData,
  PhaseKey,
} from "../../data";
import { formatError, UpdateFamily } from "./helpers";
import { BottomActions } from "./Shared";

export function PromiseSurvey({
  family,
  updateFamily,
  onBack,
  onNext,
  busy,
  setNotice,
}: {
  family: FamilyRecord;
  updateFamily: UpdateFamily;
  onBack: () => void;
  onNext: () => void;
  busy: boolean;
  setNotice: (s: string) => void;
}) {
  return (
    <section className="content-card promise-card">
      <span className="section-kicker">5. 우리 가족의 약속</span>
      <h2>30일 동안 함께 바꿔볼 점</h2>
      <img src="/assets/haeoni-red-wave.png" alt="응원하는 해온이" />
      <label className="feedback-label">
        {changeWishQuestion}
        <textarea
          value={family.changeWish || ""}
          onChange={(e) =>
            updateFamily((d) => {
              d.changeWish = e.target.value;
            })
          }
          placeholder="우리 가족의 이야기를 적어주세요."
        />
      </label>
      <BottomActions
        primary="결과 확인"
        onPrimary={() => {
          if (!(family.changeWish || "").trim()) {
            setNotice("우리 가족이 바꿔보고 싶은 점을 적어주세요.");
            return;
          }
          onNext();
        }}
        secondary="이전"
        onSecondary={onBack}
        busy={busy}
      />
    </section>
  );
}

export function Result({
  family,
  phase,
  data,
  updateFamily,
  persist,
  onBack,
  onHome,
  busy,
  setBusy,
  setNotice,
}: {
  family: FamilyRecord;
  phase: PhaseKey;
  data: PhaseData;
  updateFamily: UpdateFamily;
  persist: (f: FamilyRecord, m?: string) => Promise<void>;
  onBack: () => void;
  onHome: () => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setNotice: (s: string) => void;
}) {
  const twoAdults = hasSecondAdult(family);
  const score1 = indexScore(data.indexAnswers.adult1),
    score2 = indexScore(data.indexAnswers.adult2);
  const gap = Math.abs(score1 - score2);
  const counts = useMemo(() => {
    const visible = cardsFor(family.familyType);
    return ownerOptions
      .filter(
        (o) =>
          !(o.value === "child" && family.familyType === "childless") &&
          !(o.value === "adult2" && !twoAdults),
      )
      .map((o) => ({
        ...o,
        count: visible.filter((card) => data.cards[card.id] === o.value).length,
      }));
  }, [data.cards, family.familyType, twoAdults]);
  async function submit() {
    setBusy(true);
    try {
      const next = updateFamily((d) => {
        d[phase].status = "submitted";
      });
      if (next) await persist(next, "제출됨");
    } catch (error) {
      setNotice(formatError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="content-card result-card">
      <div className="result-hero">
        <img src="/assets/haeoni-suit-arms.png" alt="기뻐하는 해온이" />
        <div>
          <span className="section-kicker">
            {phase === "pre" ? "사전" : "사후"} 진단 결과
          </span>
          <h2>
            {family.familyName},<br />
            함께여서 더 따뜻해요!
          </h2>
        </div>
      </div>
      <div className={twoAdults ? "score-grid" : "score-grid single"}>
        <article>
          <span>{family.adults.adult1}</span>
          <strong>
            {score1}
            <small>점</small>
          </strong>
          <b>{indexType(score1)}</b>
        </article>
        {twoAdults && (
          <article>
            <span>{family.adults.adult2}</span>
            <strong>
              {score2}
              <small>점</small>
            </strong>
            <b>{indexType(score2)}</b>
          </article>
        )}
      </div>
      {twoAdults && gap >= 15 && (
        <p className="gap-note">
          두 분의 생각에 {gap}점 차이가 있어요. 틀린 답은 없습니다. 서로 다르게
          느낀 문항부터 편안하게 이야기해보세요.
        </p>
      )}
      <section className="summary-box">
        <h3>함께카드 담당 현황</h3>
        <div className="count-grid">
          {counts.map((c) => (
            <div key={c.value}>
              <span>{c.label}</span>
              <b>{c.count}장</b>
            </div>
          ))}
        </div>
      </section>
      <section className="summary-box">
        <h3>일주일 시간 비교</h3>
        <div className={twoAdults ? "time-summary" : "time-summary single"}>
          <span />
          <b>{family.adults.adult1}</b>
          {twoAdults && <b>{family.adults.adult2}</b>}
          <span>집안일·돌봄</span>
          <b>{data.times.adult1.housework}시간</b>
          {twoAdults && <b>{data.times.adult2.housework}시간</b>}
          <span>가족 챙김</span>
          <b>{data.times.adult1.mental}시간</b>
          {twoAdults && <b>{data.times.adult2.mental}시간</b>}
          <span>혼자 쉼</span>
          <b>{data.times.adult1.rest}시간</b>
          {twoAdults && <b>{data.times.adult2.rest}시간</b>}
        </div>
      </section>
      {data.status === "submitted" ? (
        <div className="submitted-box">
          <b>제출이 완료되었습니다</b>
          <p>응답은 관리자에게 안전하게 전달됐어요.</p>
          <button className="secondary-button" onClick={onHome}>
            처음 화면으로
          </button>
        </div>
      ) : (
        <BottomActions
          primary="관리자에게 제출"
          onPrimary={submit}
          secondary="이전"
          onSecondary={onBack}
          busy={busy}
        />
      )}
      <button className="print-button" onClick={() => window.print()}>
        결과 화면 출력하기
      </button>
    </section>
  );
}
