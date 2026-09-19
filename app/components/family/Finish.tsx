import { useMemo } from "react";
import {
  cardsFor,
  changeWishQuestion,
  FamilyRecord,
  hasAdditionalResponse,
  hasSecondAdult,
  hasTwoPersonReport,
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

function changeLabel(before: number, after: number) {
  const change = after - before;
  if (change > 0) return `${change}점 상승`;
  if (change < 0) return `${Math.abs(change)}점 하락`;
  return "변화 없음";
}

export function AdditionalResult({
  phase,
  respondentName,
  onHome,
  onEdit,
}: {
  phase: PhaseKey;
  respondentName: string;
  onHome: () => void;
  onEdit: () => void;
}) {
  return (
    <section className="content-card result-card additional-result">
      <div className="result-hero">
        <img src="/assets/haeoni-suit-cheer.png" alt="기뻐하는 해온이" />
        <div>
          <span className="section-kicker">선택 참여 완료</span>
          <h2>{respondentName}님의 응답을 저장했어요</h2>
        </div>
      </div>
      <p className="report-basis">
        {phase === "pre" ? "사전" : "사후"} 함께지수 10문항이 가족
        리포트에 반영됩니다. 다른 성인의 참여는 가족의 진단 완료 여부에
        영향을 주지 않습니다.
      </p>
      <div className="bottom-actions">
        <button className="secondary-button" onClick={onHome}>
          진단 선택으로
        </button>
        <button className="primary-button" onClick={onEdit}>
          응답 다시 보기
        </button>
      </div>
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
  const representativeName =
    family.applicantName || family.adults.adult1 || "대표 응답자";
  const score1 = indexScore(data.indexAnswers.adult1);
  const preScore1 = indexScore(family.pre.indexAnswers.adult1);
  const postScore1 = indexScore(family.post.indexAnswers.adult1);
  const twoPersonReport = phase === "post" && hasTwoPersonReport(family);
  const additionalName =
    family.post.indexRespondents?.adult2 ||
    family.pre.indexRespondents?.adult2 ||
    family.adults.adult2;
  const preScore2 = indexScore(family.pre.indexAnswers.adult2);
  const postScore2 = indexScore(family.post.indexAnswers.adult2);
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
        <img src="/assets/haeoni-suit-cheer.png" alt="기뻐하는 해온이" />
        <div>
          <span className="section-kicker">
            {phase === "pre" ? "사전" : "사후"} 진단 결과
          </span>
          <h2>
            {family.applicantName || family.adults.adult1}님 가족,
            <br />
            함께여서 더 따뜻해요!
          </h2>
        </div>
      </div>
      {phase === "pre" ? (
        <>
          <div className="score-grid single">
            <article>
              <span>{representativeName}</span>
              <strong>
                {score1}
                <small>점</small>
              </strong>
              <b>{indexType(score1)}</b>
            </article>
          </div>
          <p className="report-basis">
            대표 응답자가 바라본 우리 가족의 사전 모습입니다.
          </p>
        </>
      ) : (
        <section className="summary-box report-comparison">
          <div className="report-heading">
            <h3>사전·사후 함께지수</h3>
            <span>{twoPersonReport ? "2인 응답 리포트" : "1인 응답 리포트"}</span>
          </div>
          <div
            className={
              twoPersonReport ? "comparison-grid" : "comparison-grid single"
            }
          >
            <article>
              <span>{representativeName}</span>
              <div>
                <b>{preScore1}점</b>
                <i>→</i>
                <b>{postScore1}점</b>
              </div>
              <strong>{changeLabel(preScore1, postScore1)}</strong>
            </article>
            {twoPersonReport && (
              <article>
                <span>{additionalName}</span>
                <div>
                  <b>{preScore2}점</b>
                  <i>→</i>
                  <b>{postScore2}점</b>
                </div>
                <strong>{changeLabel(preScore2, postScore2)}</strong>
              </article>
            )}
          </div>
          {twoPersonReport && (
            <p className="gap-note">
              두 사람의 점수 차이: 사전 {Math.abs(preScore1 - preScore2)}점
              → 사후 {Math.abs(postScore1 - postScore2)}점
            </p>
          )}
          <p className="report-basis">
            {twoPersonReport
              ? "성인 구성원 2인의 사전·사후 응답을 각각 비교한 결과입니다."
              : `대표 응답자 ${representativeName}님의 사전·사후 응답을 비교한 결과입니다.`}
          </p>
        </section>
      )}
      {twoAdults && (
        <section className="additional-invite">
          <div>
            <b>다른 성인의 함께지수 참여</b>
            <p>
              {hasAdditionalResponse(family, phase)
                ? `${data.indexRespondents?.adult2 || family.adults.adult2}님의 선택 응답이 반영됐어요.`
                : "선택사항입니다. 같은 주소에서 가정번호와 본인 이름으로 접속하면 10문항만 작성할 수 있어요."}
            </p>
          </div>
          <span>
            {hasAdditionalResponse(family, phase) ? "응답 완료" : "선택 참여"}
          </span>
        </section>
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
